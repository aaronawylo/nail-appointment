const cdk = require('aws-cdk-lib');
const cognito = require('aws-cdk-lib/aws-cognito');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const s3 = require('aws-cdk-lib/aws-s3');
const iam = require('aws-cdk-lib/aws-iam');
require('dotenv').config();

class NailAppointmentStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // 1. DynamoDB
    const appointmentsTable = new dynamodb.Table(this, 'AppointmentsTable', {
      tableName: process.env.TABLE_NAME || 'Appointments',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'appointmentTime', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    appointmentsTable.addGlobalSecondaryIndex({
      indexName: 'TimeIndex',
      partitionKey: { name: 'appointmentTime', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 2. S3 Bucket
    const galleryBucket = new s3.Bucket(this, 'NailGalleryBucket', {
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false, blockPublicPolicy: false,
        ignorePublicAcls: false, restrictPublicBuckets: false,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
        allowedOrigins: ['http://localhost:3000','https://main.d39cw2djhxzpjt.amplifyapp.com'],
        allowedHeaders: ['*'],
      }],
    });

    // 3. Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'nail-appointment-user-pool',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
      },
    });

    //App Client (Required for frontend login)
    const appClient = userPool.addClient('WebClient', {
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: ['http://localhost:3000', 'https://main.d39cw2djhxzpjt.amplifyapp.com'],
        logoutUrls: ['http://localhost:3000', 'https://main.d39cw2djhxzpjt.amplifyapp.com'],
      },
    });

    //Cognito Domain (Required for the login page to exist)
    const domainPrefix = `nail-magic-${this.account}`;
    const userPoolDomain = userPool.addDomain('HostedDomain', {
      cognitoDomain: { domainPrefix: domainPrefix },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
    });

    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'admin',
    });

    // 4. Lambda Config
    const commonEnv = {
      TABLE_NAME: appointmentsTable.tableName,
      BUCKET_NAME: galleryBucket.bucketName,
      REGION: this.region,
    };

    const createFn = (id, handler) => new lambda.Function(this, id, {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: `${handler}.handler`,
      code: lambda.Code.fromAsset('lambda'),
      environment: commonEnv,
    });

    const createAppointmentLambda = createFn('CreateAppt', 'createAppointment');
    const viewAppointmentsLambda = createFn('ViewAppts', 'viewAppointments');
    const viewAllAppointmentsLambda = createFn('ViewAllAppts', 'viewAllAppointments');
    const deleteAppointmentLambda = createFn('DeleteAppt', 'deleteAppointment');
    const getGalleryLambda = createFn('GetGallery', 'getGalleryImages');
    const getUploadUrlLambda = createFn('GetUploadUrl', 'getUploadUrl');
    const getAvailabilityLambda = createFn('GetAvail', 'getAvailability');

    // Permissions
    createAppointmentLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    appointmentsTable.grantReadWriteData(createAppointmentLambda);
    appointmentsTable.grantReadData(viewAppointmentsLambda);
    appointmentsTable.grantReadData(viewAllAppointmentsLambda);
    appointmentsTable.grantReadWriteData(deleteAppointmentLambda);
    appointmentsTable.grantReadData(getAvailabilityLambda);
    galleryBucket.grantRead(getGalleryLambda);
    galleryBucket.grantPut(getUploadUrlLambda);

    // 5. API Gateway
    const api = new apigateway.RestApi(this, 'NailApi', {
      restApiName: 'Nail Appointment API',
      defaultCorsPreflightOptions: {
        allowOrigins: ['http://localhost:3000', 'https://main.d39cw2djhxzpjt.amplifyapp.com'],
        allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    api.root.addResource('gallery-images').addMethod('GET', new apigateway.LambdaIntegration(getGalleryLambda));
    api.root.addResource('availability').addMethod('GET', new apigateway.LambdaIntegration(getAvailabilityLambda));

    const appointments = api.root.addResource('appointments');
    const authOpts = { authorizationType: apigateway.AuthorizationType.COGNITO, authorizer };
    
    appointments.addMethod('POST', new apigateway.LambdaIntegration(createAppointmentLambda), authOpts);
    appointments.addMethod('GET', new apigateway.LambdaIntegration(viewAppointmentsLambda), authOpts);

    const admin = api.root.addResource('admin');
    admin.addResource('all-appointments').addMethod('GET', new apigateway.LambdaIntegration(viewAllAppointmentsLambda), authOpts);
    admin.addResource('get-upload-url').addMethod('POST', new apigateway.LambdaIntegration(getUploadUrlLambda), authOpts);
    admin.addResource('delete').addMethod('DELETE', new apigateway.LambdaIntegration(deleteAppointmentLambda), authOpts);

    // 6. Outputs
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'ClientId', { value: appClient.userPoolClientId });
    new cdk.CfnOutput(this, 'CognitoDomain', { value: `${domainPrefix}.auth.${this.region}.amazoncognito.com` });
  }
}

module.exports = { NailAppointmentStack };