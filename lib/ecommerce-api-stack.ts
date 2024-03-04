import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';

export class EcommerceApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const RaffleTable = new dynamodb.Table(this, 'Raffles', {
      tableName: 'Raffles',
      partitionKey: { name: '_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    } as dynamodb.TableProps)

    const RaffleTicketsTable = new dynamodb.Table(this, 'RaffleTickets', {
      tableName: 'RaffleTickets',
      partitionKey: { name: '_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    } as dynamodb.TableProps)

    const RafflesLamdba = new nodejs.NodejsFunction(this, 'RafflesLambda', {
      entry:'./src/raffles.ts', 
      functionName: "Raffles",
      handler: 'Raffles',
      memorySize: 1024,
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(300),
      bundling: {
        preCompilation: true,
        define: { // Replace strings during build time
          'process.env.REGION': JSON.stringify('us-east-1'),
          'process.env.PAGE_SIZE': JSON.stringify(25),
        },
      },
      environment:{
        REGION: 'us-east-1',
        PAGE_SIZE: '25',
        RAFFLES:RaffleTable.tableName,
        RAFFLETICKETS:RaffleTicketsTable.tableName
      }
    });

    RaffleTable.grantFullAccess(RafflesLamdba)
    RaffleTicketsTable.grantFullAccess(RafflesLamdba)

    const RaffleApi = new apigateway.RestApi(this, 'RafflesApi')

    RaffleApi.root
    .resourceForPath("raffles")
    .addMethod("POST", new apigateway.LambdaIntegration(RafflesLamdba))

    RaffleApi.root
    .resourceForPath("raffles/{_id}")
    .addMethod("GET", new apigateway.LambdaIntegration(RafflesLamdba))

    RaffleApi.root
    .resourceForPath("raffles")
    .addMethod("GET", new apigateway.LambdaIntegration(RafflesLamdba))

    RaffleApi.root
    .resourceForPath("raffles")
    .addMethod("PUT", new apigateway.LambdaIntegration(RafflesLamdba))
  }
}
