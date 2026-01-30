const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const client = new DynamoDBClient({ region: process.env.REGION });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Credentials": true,
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS"
};

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  try {
    const claims = event.requestContext?.authorizer?.claims;
    if (!claims?.sub) {
      return { 
        statusCode: 401, 
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Unauthorized' }) 
      };
    }

    const userId = claims.sub;
    const body = JSON.parse(event.body);

    const params = {
      TableName: process.env.TABLE_NAME,
      Item: {
        userId: { S: userId },
        appointmentTime: { S: body.appointmentTime }
      }
    };

    await client.send(new PutItemCommand(params));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Appointment created', appointmentTime: body.appointmentTime }),
    };
  } catch (err) {
    console.error(err);
    return { 
      statusCode: 500, 
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Internal server error' }) 
    };
  }
};