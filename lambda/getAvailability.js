const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const client = new DynamoDBClient({ region: process.env.REGION });

exports.handler = async () => {
  const data = await client.send(new ScanCommand({ TableName: process.env.TABLE_NAME }));
  const times = (data.Items || []).map(item => item.appointmentTime.S);
  
  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "http://localhost:3000" },
    body: JSON.stringify({ bookedSlots: times }),
  };
};