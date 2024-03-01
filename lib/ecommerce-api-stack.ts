import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class EcommerceApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    new dynamodb.Table(this, 'Raffles', {
      tableName: 'Raffles',
      partitionKey: { name: '_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    } as dynamodb.TableProps)

    new dynamodb.Table(this, 'RaffleTickets', {
      tableName: 'RaffleTickets',
      partitionKey: { name: '_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    } as dynamodb.TableProps)

    const RafflesLamdba = new lambda.Function(this, 'RafflesLambda', {
      code: lambda.Code.fromAsset('./src'),
      functionName: "Raffles",
      handler: 'raffles.Raffles',
      memorySize: 1024,
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(300),
    });

    const RaffleApi = new apigateway.RestApi(this, 'RafflesApi')

    RaffleApi.root
    .resourceForPath("raffles")
    .addMethod("POST", new apigateway.LambdaIntegration(RafflesLamdba))
  }
}
