const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: process.env.REGION });

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  try {
    const claims = event.requestContext?.authorizer?.claims;
    if (!claims?.sub) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
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
      body: JSON.stringify({ appointments }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal server error' }) };
  }
};
