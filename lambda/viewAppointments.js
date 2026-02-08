const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: process.env.REGION });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://main.d39cw2djhxzpjt.amplifyapp.com",
  "Access-Control-Allow-Credentials": true,
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,OPTIONS"
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

    const params = {
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: {
        ":uid": { S: userId }
      }
    };

    const result = await client.send(new QueryCommand(params));

    const appointments = result.Items?.map(item => ({
      userId: item.userId.S,
      appointmentTime: item.appointmentTime.S
    }));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ appointments }),
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