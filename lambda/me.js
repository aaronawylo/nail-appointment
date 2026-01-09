// lambda/me.js
exports.handler = async (event) => {
  console.log("Full event:", JSON.stringify(event, null, 2));

  // Safe extraction of Cognito JWT claims
  const auth = event.requestContext?.authorizer || {};
  const claims = (auth.jwt && auth.jwt.claims) || auth.claims || {};

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "You are authenticated!",
      claims
    }),
  };
};

