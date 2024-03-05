import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';

export class EcommerceApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const ProductTable = new dynamodb.Table(this, 'product', {
      tableName: 'product',
      partitionKey: { name: '_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    } as dynamodb.TableProps)

    const ProductVariationTable = new dynamodb.Table(this, 'productvariation', {
      tableName: 'productvariation',
      partitionKey: { name: '_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    } as dynamodb.TableProps)

    const ProductLamdba = new nodejs.NodejsFunction(this, 'ProductLambda', {
      entry:'./src/product.ts', 
      functionName: "Product",
      handler: 'Product',
      memorySize: 1024,
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(300),
      bundling: {
        preCompilation: true,
      },
      environment:{
        REGION: 'us-east-1',
        PAGE_SIZE: '25',
        PRODUCT:ProductTable.tableName,
        PRODUCTVARIATION:ProductVariationTable.tableName
      }
    });

    ProductTable.grantFullAccess(ProductLamdba)
    ProductVariationTable.grantFullAccess(ProductLamdba)

    const EccommerceAPI = new apigateway.RestApi(this, 'EcommerceAPI')

    EccommerceAPI.root
    .resourceForPath("product")
    .addMethod("POST", new apigateway.LambdaIntegration(ProductLamdba))

    EccommerceAPI.root
    .resourceForPath("product")
    .addMethod("GET", new apigateway.LambdaIntegration(ProductLamdba))

    EccommerceAPI.root
    .resourceForPath("product")
    .addMethod("PUT", new apigateway.LambdaIntegration(ProductLamdba))

    EccommerceAPI.root
    .resourceForPath("product")
    .addMethod("DELETE", new apigateway.LambdaIntegration(ProductLamdba))
  }
}
