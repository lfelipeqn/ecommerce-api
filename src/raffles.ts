import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBClient, BatchWriteItemCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

dotenv.config();

const connectDB = async () => {
const client = new DynamoDBClient({
  region: process.env.REGION,
  //endpoint: process.env.HOST_DATABASE /** Omitir endpoint en entorno productivo */
});
const ddbDocClient = DynamoDBDocumentClient.from(client);
return ddbDocClient;
}
 
const generateRandomTickets = (digitosTicket:number, totalTickets:number) => {
  if (digitosTicket <= 0 || digitosTicket > 16) {
    throw new Error("La cantidad de dígitos debe estar entre 1 y 16.");
  }

  const minimo = Math.pow(10, digitosTicket - 1);
  const maximo = Math.pow(10, digitosTicket) - 1;

  // Use a Set to store unique tickets efficiently
  const tickets = new Set();
  while (tickets.size < totalTickets) {
    // Generate a random ticket
    const numeroAleatorio = Math.floor(Math.random() * (maximo - minimo + 1)) + minimo;

    // Add the ticket to the set only if it's unique
    if (!tickets.has(numeroAleatorio)) {
      tickets.add(numeroAleatorio);
    }
  }

  return Array.from(tickets); // Convert the Set to an array
};

const getAllProducts = async (): Promise<any[]> => {
  const client = await connectDB();
  const params = {
    TableName: 'Raffles',
  };

  try {
    const data = await client.send(new ScanCommand(params));
    return (data.Items as any[]) || [];
  } catch (err) {
    console.error("Error scanning table:", err);
    throw err; // Rethrow the error to handle it in the calling function
  }
};

const createdAt = new Date().getTime();
const updatedAt = new Date().getTime();

const pageSize:number = Number(process.env.PAGE_SIZE);

exports.Raffles = async (event:any, context:any, callback:any) => {
  
  let httpMethod:string = event.httpMethod;
  let response:any = {};
  const body = event.body ? JSON.parse(event.body) : null
  let _id:string | null = event?.queryStringParameters?._id || body?._id || null;
  switch (httpMethod){
    case 'GET':
      if(_id !== undefined && _id !== null){
        const result = new GetCommand({
          TableName: 'Raffles',
          Key:{
            _id: _id
          }
        })
        const client = await connectDB();
        const raffleRecord:any = await client.send(result)
        response = {
          statusCode:200,
          body: JSON.stringify(raffleRecord.Item)
        }
     }else{
        try{
          let allRaffleCollection = await getAllProducts();
          response = {
            statusCode:200,
            body: JSON.stringify(allRaffleCollection)
          }
        }catch(error){
          console.log(error)
          response = {
            statusCode: 500,
            body: JSON.stringify({ error}),
          };
        }        
      }
      break;
    case 'POST':
      if(body !== undefined && body !== null){
        const raffle = {
          _id:uuidv4(),
          name: body.name|| '',
          logo:body.logo || '',
          description:body.description || '',
          digitosTicket:body.digitosTicket || 0,
          totalTickets:body.totalTickets || 0,
          maxSale:body.maxSale || 0,
          price:body.price || 0,
          createdAt,
          updatedAt,
        }

        const raffleTicketsColletion:any[] = [];
        const PutRequestCollection:any[] = [];

        try{
          const result = new PutCommand({
            TableName: 'Raffles',
            Item: raffle,
          })

          const client = await connectDB();
          await client.send(result);

          const getraffleid = new GetCommand({
            TableName: 'Raffles',Key:{
              _id: raffle._id
            }
          })

          const getraffle:any = await client.send(getraffleid)

          let randomTicketsRaffleJSON:any[] = generateRandomTickets(raffle.digitosTicket, raffle.totalTickets);

          for(let i=0; i<raffle.totalTickets; i++){
            let randomTicketsRaffle = randomTicketsRaffleJSON[i]
            let tempTicket:any = {
              _id: uuidv4(),
              raffle:getraffle.Item._id,
              reference:randomTicketsRaffle,
              price:raffle.price,
              quantity:1,
              createdAt,
              updatedAt,
            }
            
            PutRequestCollection.push({
              "PutRequest":{
                "Item":marshall({
                  _id: tempTicket._id,
                  raffle:tempTicket.raffle,
                  reference:tempTicket.reference,
                  price:tempTicket.price,
                  quantity:tempTicket.quantity,
                  createdAt:tempTicket.createdAt,
                  updatedAt:tempTicket.updatedAt,
                }),
              }
            })

            raffleTicketsColletion.push(tempTicket);

          }

          // Calculate the total number of pages
          const totalPages = Math.ceil(PutRequestCollection.length / pageSize);
          // Process the array in pages
          for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
            // Calculate the start and end index for the current page
            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = currentPage * pageSize;
            // Get the current page data
            let currentPageData:any[] = PutRequestCollection.slice(startIndex, endIndex);
            if (currentPageData.length > 0) {
              const query = new BatchWriteItemCommand({
                "RequestItems":{
                  "RaffleTickets":currentPageData
                }  
              })
              await client.send(query);
            }
          }
        }catch(error){
          console.log(error);
        }

        response = {
          statusCode: 200,
          body: JSON.stringify(raffleTicketsColletion),
        };
      }else{
        response = {
          statusCode:400,
          body: JSON.stringify({message:'Se necesita los campos para creacion del registro'})
        }
      }
      break;
    case 'PUT':
      if(_id !== undefined && _id !== null){

        try{

        const updateExpression:any = ["set updatedAt = :updatedAt"];
        const expressionAttributeValues:any = { ":updatedAt": updatedAt };

        Object.keys(body).forEach((key) => {
          if(key!=='_id'){
            updateExpression.push(`${key} = :${key}`);
            expressionAttributeValues[`:${key}`] = body[key];
          }
        });

        const result = new UpdateItemCommand({
          TableName: 'Raffles',
          Key: {
            _id: { S: _id },
          },
          UpdateExpression: updateExpression.join(', '),
          ExpressionAttributeValues: marshall(expressionAttributeValues),
          ReturnValues: 'ALL_NEW', 
        });

          const client = await connectDB();
          const updateRecords:any = await client.send(result)
          response = {
            statusCode:200,
            body: JSON.stringify(unmarshall(updateRecords.Attributes))
          }
        }catch(error){
          console.log(error)
          response = {
            statusCode: 400,
            body: JSON.stringify({ error}),
          };
        }
      }else{
        response = {
          statusCode:400,
          body: JSON.stringify({message:'Se necesita el _id para realizar para actualizar'})
        }
      }
      break;
  }
  
  return response;
  
};