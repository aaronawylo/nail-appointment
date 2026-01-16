const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const client = new DynamoDBClient({ region: process.env.REGION });

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  try {
    const claims = event.requestContext?.authorizer?.claims;
    if (!claims?.sub) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
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
      body: JSON.stringify({ message: 'Appointment created', appointmentTime: body.appointmentTime }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal server error' }) };
  }
};
