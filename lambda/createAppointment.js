const { DynamoDBClient, PutItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const client = new DynamoDBClient({ region: process.env.REGION });
const ses = new SESClient({ region: process.env.REGION });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Credentials": "true"
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS };

  try {
    const claims = event.requestContext.authorizer.claims;
    const userId = claims.sub;
    const userEmail = claims.email;
    const userName = `${claims.given_name} ${claims.family_name}`;
    
    const { appointmentTime, service } = JSON.parse(event.body);

    // 1. Check for double booking
    const checkParams = {
      TableName: process.env.TABLE_NAME,
      IndexName: "TimeIndex",
      KeyConditionExpression: "appointmentTime = :t",
      ExpressionAttributeValues: { ":t": { S: appointmentTime } }
    };
    const existing = await client.send(new QueryCommand(checkParams));
    if (existing.Items && existing.Items.length > 0) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ message: "Slot taken" }) };
    }

    // 2. Save Appointment
    await client.send(new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: {
        userId: { S: userId },
        appointmentTime: { S: appointmentTime },
        userName: { S: userName },
        userEmail: { S: userEmail },
        service: { S: service }
      }
    }));

    // 3. Send Email Notification
    const emailParams = {
      Source: "YOUR_VERIFIED_EMAIL@gmail.com", // Change this!
      Destination: { ToAddresses: [userEmail, "YOUR_VERIFIED_EMAIL@gmail.com"] },
      Message: {
        Subject: { Data: "Booking Confirmed! 💅" },
        Body: { Text: { Data: `Hi ${userName}, your ${service} is booked for ${appointmentTime}.` } }
      }
    };
    await ses.send(new SendEmailCommand(emailParams));

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ message: "Success" }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};