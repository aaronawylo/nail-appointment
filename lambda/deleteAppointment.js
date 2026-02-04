const { DynamoDBClient, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
const client = new DynamoDBClient({ region: process.env.REGION });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "DELETE,OPTIONS",
  "Access-Control-Allow-Credentials": "true"
};

exports.handler = async (event) => {
  // 1. Handle the browser's "pre-check" (OPTIONS)
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 200, 
      headers: CORS_HEADERS, 
      body: JSON.stringify({ message: "CORS Preflight Success" }) 
    };
  }

  try {
    const { userId, appointmentTime } = JSON.parse(event.body);

    // 2. Perform the actual delete
    await client.send(new DeleteItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        userId: { S: userId },
        appointmentTime: { S: appointmentTime }
      }
    }));

    return { 
      statusCode: 200, 
      headers: CORS_HEADERS, // MUST include these here too!
      body: JSON.stringify({ message: "Appointment deleted" }) 
    };
  } catch (err) {
    console.error(err);
    return { 
      statusCode: 500, 
      headers: CORS_HEADERS, 
      body: JSON.stringify({ error: err.message }) 
    };
  }
};