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

const createBatches = (array:any[], batchSize:number) => {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
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
    TableName: process.env.PRODUCT,
  };

  try {
    const data = await client.send(new ScanCommand(params));
    if (!data.Items || data.Items.length === 0) {
      return [];
    }
    const allItems = createBatches(data.Items as any[], Number(process.env.PAGE_SIZE));
    return allItems || [];
  } catch (err) {
    console.error("Error scanning table:", err);
    throw err; // Rethrow the error to handle it in the calling function
  }
};

const deleteProductVariation = async (client: any, productId: string) => {
  try {
    const ticketsToDelete = await client.send(new ScanCommand({
      TableName: process.env.PRODUCTVARIATION,
      FilterExpression: 'product = :product',
      ExpressionAttributeValues: {':product': productId},
    }));

    const deleteRequests = ticketsToDelete.Items.map((ticket:any) => ({
      DeleteRequest: {
        TableName: process.env.PRODUCTVARIATION,
        Key: { _id: marshall(ticket._id) },
      },
    }));


    const deleteRequestBatches = createBatches(deleteRequests, Number(process.env.PAGE_SIZE));

    for (const batch of deleteRequestBatches) {
      await client.send(new BatchWriteItemCommand({
        RequestItems: { 'productvariation': batch },
      }));
    }

    if (deleteRequests.length > 0) {
      await client.send(new BatchWriteItemCommand({
        RequestItems: { 'productvariation': deleteRequests },
      }));
    }

  } catch (error: any) {
    console.error('Error deleting tickets:', error);
    return;
  }
};

const createdAt = new Date().getTime();
const updatedAt = new Date().getTime();

const pageSize:number = Number(process.env.PAGE_SIZE);

exports.Product = async (event:any, context:any, callback:any) => {
  
  let httpMethod:string = event.httpMethod;
  let response:any = {};
  const body = event.body ? JSON.parse(event.body) : null
  let _id:string | null = event?.queryStringParameters?._id || event?.pathParameters?._id || body?._id || null;
  switch (httpMethod){
    case 'GET':
      if(_id !== undefined && _id !== null){
        const result = new GetCommand({
          TableName: process.env.PRODUCT,
          Key:{
            _id: _id
          }
        })
        const client = await connectDB();
        const productRecord:any = await client.send(result)
        response = {
          statusCode:200,
          body: JSON.stringify(productRecord.Item)
        }
     }else{
        try{
          let allProductCollection = await getAllProducts();
          response = {
            statusCode:200,
            body: JSON.stringify(allProductCollection)
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
        const product = {
          _id:uuidv4(),
          active:body.active || false,
          category:body.category || '',
          channel: '',
          description:body.description || '',
          manufacturer:body.manufacturer || '',
          name: body.name || '',
          reference: body.reference || '',
          seller: body.seller || '',
          digitosTicket:body.digitosTicket || 0,
          totalTickets:body.totalTickets || 0,
          maxSale:body.maxSale || 0,
          price:body.price || 0,
          createdAt,
          updatedAt,
        }

        const productVariationColletion:any[] = [];
        const PutRequestCollection:any[] = [];

        try{
          const result = new PutCommand({
            TableName: process.env.PRODUCT,
            Item: product,
          })

          const client = await connectDB();
          await client.send(result);

          const getproductid = new GetCommand({
            TableName: process.env.PRODUCT,Key:{
              _id: product._id
            }
          })

          const getproduct:any = await client.send(getproductid)

          let randomTicketsRaffleJSON:any[] = generateRandomTickets(product.digitosTicket, product.totalTickets);

          for(let i=0; i<product.totalTickets; i++){
            let randomTicketsRaffle = randomTicketsRaffleJSON[i]
            let tempTicket:any = {
              _id: uuidv4(),
              price:product.price,
              product:getproduct.Item._id,
              reference:randomTicketsRaffle,
              quantity:1,
              seller:product.seller,
              variation: '', /** Datos pendiente por obtener */
              warehouses: '', /** Datos pendiente por obtener*/
              createdAt,
              updatedAt,
            }
            
            PutRequestCollection.push({
              "PutRequest":{
                "Item":marshall({
                  _id: tempTicket._id,
                  price:tempTicket.price,
                  product:tempTicket.product,
                  reference:tempTicket.reference,
                  quantity:tempTicket.quantity,
                  seller:tempTicket.seller,
                  variation: tempTicket.variation,
                  warehouses: tempTicket.warehouses,
                  createdAt: tempTicket.createdAt,
                  updatedAt: tempTicket.updatedAt,
                }),
              }
            })

            productVariationColletion.push(tempTicket);

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
                  "productvariation":currentPageData
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
          body: JSON.stringify(productVariationColletion),
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
          TableName: process.env.PRODUCT,
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
    case 'DELETE':
      if(_id !== undefined && _id !== null){
        try{

          const productId = _id;
          const client = await connectDB();
          
          await deleteProductVariation(client, productId);

          await client.send(new DeleteItemCommand({
            TableName: process.env.PRODUCT,
            Key: {_id :{ S : _id }}
          }))
  
  
          response = {
            statusCode:200,
            body: JSON.stringify(`Sorteo Eliminado ${productId}`)
          }
        }catch(error){
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