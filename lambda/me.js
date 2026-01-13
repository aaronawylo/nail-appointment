// lambda/me.js
exports.handler = async (event) => {
  console.log(JSON.stringify(event)); // always log the event during debugging

  const claims = event.requestContext?.authorizer?.claims || {};

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "You are authenticated!",
      claims,
    }),
  };
};


