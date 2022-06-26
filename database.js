import { MongoClient } from "mongodb";

function connectToDatabase() {
  let db;
  const mongoClient = new MongoClient(process.env.DATABASE_URL);
  const promise = mongoClient.connect();

  promise.then(() => {
    db = mongoClient.db(process.env.DATABASE);
    console.log("Connected to the database!");
  });

  promise.catch((err) => console.error(err));
}

export { connectToDatabase };
