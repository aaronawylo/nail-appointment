const cdk = require('aws-cdk-lib');
const cognito = require('aws-cdk-lib/aws-cognito');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');

class NailAppointmentStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'nail-appointment-user-pool',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
    });

    // App client
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

    // Hosted domain
    userPool.addDomain('HostedDomain', {
      cognitoDomain: {
        domainPrefix: 'nail-appointment-demo-' + this.account,
      },
    });

    // Groups
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'admin',
    });
    new cognito.CfnUserPoolGroup(this, 'UserGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'user',
    });

    // Lambda
    const meLambda = new lambda.Function(this, 'MeLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'me.handler',
      code: lambda.Code.fromAsset('lambda'),
    });

    const api = new apigateway.LambdaRestApi(this, 'NailApi', {
      handler: meLambda,
      proxy: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'ClientId', { value: appClient.userPoolClientId });
    new cdk.CfnOutput(this, 'MeLambdaOutput', { value: meLambda.functionName });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
  }
}

module.exports = { NailAppointmentStack };
