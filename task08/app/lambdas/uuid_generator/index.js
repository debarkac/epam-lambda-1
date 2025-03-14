import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const REGION = 'eu-west-1';
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'uuid-storage';

const s3Client = new S3Client({ region: REGION });

export const handler = async (event) => {
    try {
        const uuids = Array(10).fill().map(() => uuidv4());

        const payload = {
            ids: uuids
        };

        const timestamp = new Date().toISOString();
        const filename = timestamp;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: filename,
            Body: JSON.stringify(payload, null, 4),
            ContentType: 'application/json'
        });

        await s3Client.send(command);

        console.log(`Successfully uploaded UUIDs to S3: s3://${BUCKET_NAME}/${filename}`);

    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};