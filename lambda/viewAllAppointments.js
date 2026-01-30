const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const client = new DynamoDBClient({ region: process.env.REGION });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Credentials": true,
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,OPTIONS"
};

exports.handler = async (event) => {
  try {
    // 1. Extra Security Check: Verify the "admin" group is in the token
    const claims = event.requestContext?.authorizer?.claims;
    const groups = claims['cognito:groups'] || "";
    
    if (!groups.includes('admin')) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "Access Denied: Admins Only" }),
      };
    }

    // 2. Fetch all appointments from DynamoDB
    const params = { TableName: process.env.TABLE_NAME };
    const result = await client.send(new ScanCommand(params));

    // 3. Map the DynamoDB format to clean JSON
    const appointments = result.Items.map((item) => ({
      userId: item.userId.S,
      appointmentTime: item.appointmentTime.S,
    }));

    // 4. Sort by time (soonest first)
    appointments.sort((a, b) => new Date(a.appointmentTime) - new Date(b.appointmentTime));

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
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};