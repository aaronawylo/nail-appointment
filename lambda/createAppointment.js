const { DynamoDBClient, PutItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");
const client = new DynamoDBClient({ region: process.env.REGION });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Credentials": true
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS };

  try {
    const body = JSON.parse(event.body);
    const { appointmentTime, service } = body;
    const claims = event.requestContext.authorizer.claims;
    
    // Get names from Cognito registration
    const fullName = `${claims['given_name']} ${claims['family_name']}`;
    const userId = claims.sub;

    // 1. Check if time slot is already taken
    const checkQuery = new QueryCommand({
      TableName: process.env.TABLE_NAME,
      IndexName: 'TimeIndex',
      KeyConditionExpression: 'appointmentTime = :t',
      ExpressionAttributeValues: { ':t': { S: appointmentTime } }
    });

    const existing = await client.send(checkQuery);

    if (existing.Items && existing.Items.length > 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "That time slot is already booked!" }),
      };
    }

    // 2. Save appointment with the user's name
    const putCommand = new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: {
        userId: { S: userId },
        appointmentTime: { S: appointmentTime },
        userName: { S: fullName },
        service: { S: service || 'Nail Service' },
        createdAt: { S: new Date().toISOString() }
      }
    });

    await client.send(putCommand);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "Booking successful!", userName: fullName }),
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "Internal Server Error", error: err.message }),
    };
  }
};