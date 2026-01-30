const cdk = require('aws-cdk-lib');
const cognito = require('aws-cdk-lib/aws-cognito');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const s3 = require('aws-cdk-lib/aws-s3');

require('dotenv').config();

class NailAppointmentStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // ========================
    // DynamoDB Table
    // ========================
    const appointmentsTable = new dynamodb.Table(this, 'AppointmentsTable', {
      tableName: process.env.TABLE_NAME || 'Appointments',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'appointmentTime', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, 
    });

    // ========================
    // S3 Bucket for Nail Gallery
    // ========================
    const galleryBucket = new s3.Bucket(this, 'NailGalleryBucket', {
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
          allowedOrigins: ['http://localhost:3000'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // ========================
    // Cognito User Pool
    // ========================
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'nail-appointment-user-pool',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
    });

    const appClient = userPool.addClient('WebClient', {
      authFlows: { userSrp: true },
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: ['http://localhost:3000'],
        logoutUrls: ['http://localhost:3000'],
      },
    });

    userPool.addDomain('HostedDomain', {
      cognitoDomain: { domainPrefix: 'nail-appointment-demo-' + this.account },
    });

    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'admin',
    });

    // ========================
    // Lambda functions
    // ========================
    const commonEnv = {
      TABLE_NAME: appointmentsTable.tableName,
      BUCKET_NAME: galleryBucket.bucketName,
      REGION: this.region,
    };

    const meLambda = new lambda.Function(this, 'MeLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'me.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: commonEnv,
    });

    const createAppointmentLambda = new lambda.Function(this, 'CreateAppointmentLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'createAppointment.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: commonEnv,
    });

    const viewAppointmentsLambda = new lambda.Function(this, 'ViewAppointmentsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'viewAppointments.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: commonEnv,
    });

    const viewAllAppointmentsLambda = new lambda.Function(this, 'ViewAllAppointmentsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'viewAllAppointments.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: commonEnv,
    });

    const getGalleryLambda = new lambda.Function(this, 'GetGalleryLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getGalleryImages.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: commonEnv,
    });

    const getUploadUrlLambda = new lambda.Function(this, 'GetUploadUrlLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getUploadUrl.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: commonEnv,
    });

    // Grant Permissions
    appointmentsTable.grantReadWriteData(createAppointmentLambda);
    appointmentsTable.grantReadData(viewAppointmentsLambda);
    appointmentsTable.grantReadData(viewAllAppointmentsLambda);
    galleryBucket.grantRead(getGalleryLambda);
    galleryBucket.grantPut(getUploadUrlLambda);

    // ========================
    // API Gateway
    // ========================
    const api = new apigateway.RestApi(this, 'NailApi', {
      restApiName: 'Nail Appointment API',
      defaultCorsPreflightOptions: {
        allowOrigins: ['http://localhost:3000'],
        allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
    });

    // Public Routes
    const galleryResource = api.root.addResource('gallery-images');
    galleryResource.addMethod('GET', new apigateway.LambdaIntegration(getGalleryLambda)); 

    // User Routes
    const meResource = api.root.addResource('me');
    meResource.addMethod('GET', new apigateway.LambdaIntegration(meLambda), {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer,
    });

    const appointmentsResource = api.root.addResource('appointments');
    appointmentsResource.addMethod('POST', new apigateway.LambdaIntegration(createAppointmentLambda), {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer,
    });
    appointmentsResource.addMethod('GET', new apigateway.LambdaIntegration(viewAppointmentsLambda), {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer,
    });

    // Admin Routes
    const adminResource = api.root.addResource('admin');
    
    const allAppointments = adminResource.addResource('all-appointments');
    allAppointments.addMethod('GET', new apigateway.LambdaIntegration(viewAllAppointmentsLambda), {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer,
    });

    const uploadUrlResource = adminResource.addResource('get-upload-url');
    uploadUrlResource.addMethod('POST', new apigateway.LambdaIntegration(getUploadUrlLambda), {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer,
    });

    // ========================
    // Outputs
    // ========================
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'GalleryBucketName', { value: galleryBucket.bucketName });
  }
}

module.exports = { NailAppointmentStack };