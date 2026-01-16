exports.handler = async (event) => {
  console.log(JSON.stringify(event));
  const claims = event.requestContext?.authorizer?.claims || {};
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "You are authenticated!",
      claims,
    }),
  };
};
