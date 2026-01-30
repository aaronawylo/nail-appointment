const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const client = new S3Client({ region: process.env.REGION });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Credentials": true
};

exports.handler = async (event) => {
  console.log("Fetching images from bucket:", process.env.BUCKET_NAME); // DEBUG LOG

  try {
    const bucketName = process.env.BUCKET_NAME;
    const region = process.env.REGION;

    const command = new ListObjectsV2Command({
      Bucket: bucketName,
    });

    // CRITICAL: We must 'await' the result
    const data = await client.send(command);
    
    console.log("S3 Response Data:", JSON.stringify(data)); // DEBUG LOG

    // In SDK v3, 'Contents' is undefined if the bucket is empty or filtered
    const images = (data.Contents || []).map((file) => ({
      key: file.Key,
      url: `https://${bucketName}.s3.${region}.amazonaws.com/${file.Key}`
    }));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ images }),
    };
  } catch (err) {
    console.error("S3 Error:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "Could not fetch images", error: err.message }),
    };
  }
};