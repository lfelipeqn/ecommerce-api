import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBClient, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

dotenv.config();

 const connectDB = async () => {
  const client = new DynamoDBClient({
    region: 'us-east-1',
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

const createdAt = new Date().getTime();
const updatedAt = new Date().getTime();

const pageSize:number = 25;

exports.Raffles = async (event:any, context:any, callback:any) => {
  // You can optionally adjust the number of tickets here
  const digitosTicket = event?.queryStringParameters.digitosTicket // Read from event if provided
  const totalTickets = event?.queryStringParameters.totalTickets

  const raffle = {
    _id:uuidv4(),
    name: event?.queryStringParameters.name,
    logo:event?.queryStringParameters.logo || null,
    description:event?.queryStringParameters.description || null,
    digitosTicket:event?.queryStringParameters.digitosTicket || 0,
    totalTickets:event?.queryStringParameters.totalTickets || 0,
    maxSale:event?.queryStringParameters.maxSale || 0,
    price:event?.queryStringParameters.price || 0,
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

    let randomTicketsRaffleJSON:any[] = generateRandomTickets(digitosTicket, totalTickets);

    for(let i=0; i<totalTickets; i++){
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
  const response = {
    statusCode: 200,
    body: JSON.stringify(raffleTicketsColletion),
  };

  return response;
};