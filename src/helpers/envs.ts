import dotenv from 'dotenv';
dotenv.config();
import { get } from 'env-var';

export const envs = {
    GOOGLE_APPLICATION_CREDENTIALS: get('GOOGLE_APPLICATION_CREDENTIALS').required().asString(),
    NODE_ENV: get('NODE_ENV').default('development').asString(),

    PORT: get('PORT').required().asPortNumber(),

    POSTGRES_USER: get('POSTGRES_USER').required().asString(),
    POSTGRES_PASSWORD: get('POSTGRES_PASSWORD').required().asString(),
    POSTGRES_DB: get('POSTGRES_DB').required().asString(),
    POSTGRES_HOST: get('POSTGRES_HOST').required().asString(),
    POSTGRES_PORT: get('POSTGRES_PORT').required().asPortNumber(),

    BCRYPT_SALT_ROUNDS: get('BCRYPT_SALT_ROUNDS').required().asIntPositive(),
    JWT_SECRET: get('JWT_SECRET').required().asString(),

    CLOUDINARY_API_SECRET: get('CLOUDINARY_API_SECRET').required().asString(),
    CLOUDINARY_API_KEY: get('CLOUDINARY_API_KEY').required().asString(),
    CLOUDINARY_KEY_NAME: get('CLOUDINARY_KEY_NAME').required().asString(),

    FRONT_URL: get('FRONT_URL').required().asString(),
    API_URL: get('API_URL').required().asString(),

    MP_CLIENT_ID: get('MP_CLIENT_ID').required().asString(),
    MP_CLIENT_SECRET: get('MP_CLIENT_SECRET').required().asString(),
    MP_PUBLIC_KEY: get('MP_PUBLIC_KEY').required().asString(),
    MP_ACCESS_TOKEN: get('MP_ACCESS_TOKEN').required().asString(),
    MP_X_SIGNATURE: get('MP_X_SIGNATURE').required().asString(),
    MP_USER_ID: get('MP_USER_ID').required().asString(),
    MP_EXTERNAL_POS_ID: get('MP_EXTERNAL_POS_ID').asString(),
    MP_POINT_DEVICE_ID: get('MP_POINT_DEVICE_ID').asString(),
}