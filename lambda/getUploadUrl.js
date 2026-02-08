const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const client = new S3Client({ region: process.env.REGION });

exports.handler = async (event) => {
    const { fileName, fileType } = JSON.parse(event.body);
    
    const command = new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: fileName,
        ContentType: fileType
    });

    try {
        const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
        return {
            statusCode: 200,
            headers: { 
                "Access-Control-Allow-Origin": "https://main.d39cw2djhxzpjt.amplifyapp.com",
                "Access-Control-Allow-Headers": "Content-Type,Authorization" 
            },
            body: JSON.stringify({ uploadUrl })
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
    }
};