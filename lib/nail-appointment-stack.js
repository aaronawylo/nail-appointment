const cdk = require('aws-cdk-lib');
const cognito = require('aws-cdk-lib/aws-cognito');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');

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
      removalPolicy: cdk.RemovalPolicy.DESTROY, // only for dev/testing
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
    new cognito.CfnUserPoolGroup(this, 'UserGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'user',
    });

    // ========================
    // Lambda functions
    // ========================
    const commonEnv = {
      TABLE_NAME: appointmentsTable.tableName,
      REGION: this.region,
    };

    const meLambda = new lambda.Function(this, 'MeLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'me.handler',
      code: lambda.Code.fromAsset('lambda'),
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

    // Grant Lambdas access to DynamoDB table
    appointmentsTable.grantReadWriteData(createAppointmentLambda);
    appointmentsTable.grantReadData(viewAppointmentsLambda);

    // ========================
    // API Gateway
    // ========================
    const api = new apigateway.RestApi(this, 'NailApi', {
      restApiName: 'Nail Appointment API',
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
    });

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

    // ========================
    // Outputs
    // ========================
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'ClientId', { value: appClient.userPoolClientId });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'TableName', { value: appointmentsTable.tableName });
  }
}

module.exports = { NailAppointmentStack };
