import express from "express";
import cors from "cors";
import dotenv, { config } from "dotenv";
import joi from "joi";
import { MongoClient } from "mongodb";
import { connectToDatabase } from "./database.js";

const app = express();
app.use(cors);
app.use(express.json());
dotenv.config();

async function main() {
  connectToDatabase();
}

main().catch(console.error);
