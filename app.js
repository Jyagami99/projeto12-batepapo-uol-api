import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";

async function main() {
  dotenv.config();

  let db;
  const mongoClient = new MongoClient(process.env.DATABASE_URL);
  const promise = mongoClient.connect();

  promise.then(() => {
    db = mongoClient.db(process.env.DATABASE);
    console.log("Connected to the database!");
  });
  promise.catch((err) => console.error(err));

  const server = express();

  server.use(cors());
  server.use(express.json());

  server.get("/participants", async (req, res) => {
    try {
      const participants = await db.collection("participants").find().toArray();

      res.send(participants);
    } catch (err) {
      console.log(err);

      return res.status(500).send(err);
    }
  });

  server.post("/participants", async (req, res) => {
    const participant = req.body;
    const participantSchema = joi.object({
      name: joi.string().min(1).required(),
    });
    const { error } = participantSchema.validate(participant);

    if (error) {
      console.log(error);
      return res.sendStatus(422);
    }

    try {
      const participantExists = await db.collection("participants").findOne({
        name: participant.name,
      });

      if (participantExists) {
        return res.sendStatus(409);
      }

      await db.collection("participants").insertOne({
        name: participant.name,
        lastStatus: Date.now(),
      });
      await db.collection("messages").insertOne({
        from: participant.name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs().format("HH:MM:SS"),
      });

      res.sendStatus(201);
    } catch (err) {
      console.log(err);

      return res.status(500).send(err);
    }
  });

  server.get("/messages", async (req, res) => {
    const limit = parseInt(req.query.limit, 10);
    const { user } = req.headers;

    try {
      const messages = await db.collection("messages").find().toArray();
      const filteredMessages = messages.filter((message) => {
        const { from, to, type } = message;
        const toUser = to === "Todos" || to === user || from === user;
        const isPublic = type === "message";

        return toUser || isPublic;
      });

      if (limit && limit !== NaN) {
        return res.send(filteredMessages.slice(-limit));
      }

      res.send(filteredMessages);
    } catch (err) {
      console.log(err);

      res.sendStatus(500);
    }
  });

  server.post("/messages", async (req, res) => {
    const message = req.body;
    const messageSchema = joi.object({
      to: joi.string().required(),
      text: joi.string().required(),
      type: joi.string().valid("message", "private_message").required(),
    });
    const { error } = messageSchema.validate(message, { abortEarly: false });

    if (error) {
      return res.status(422).send(
        error.details.map((detail) => {
          detail.message;
        })
      );
    }

    const { user } = req.headers;

    try {
      const participant = await db
        .collection("participants")
        .findOne({ name: user });
      if (!participant) {
        return res.sendStatus(422);
      }

      const { to, text, type } = message;
      await db.collection("messages").insertOne({
        to,
        text,
        type,
        from: user,
        time: dayjs().format("HH:MM:SS"),
      });

      res.sendStatus(201);
    } catch (err) {
      return res.sendStatus(422);
    }
  });

  server.post("/status", async (req, res) => {
    const { user } = req.headers;

    try {
      const participant = await db
        .collection("participants")
        .findOne({ name: user });

      if (!participant) {
        return res.sendStatus(404);
      }

      await db
        .collection("participants")
        .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });

      res.sendStatus(200);
    } catch (err) {
      console.log(err);

      res.sendStatus(500);
    }
  });

  const TIME_TO_CHECK = 15 * 1000;
  setInterval(async () => {
    const seconds = Date.now() - 10 * 1000;

    try {
      const inactiveParticipants = await db
        .collection("participants")
        .find({ lastStatus: { $lte: seconds } })
        .toArray();

      if (inactiveParticipants.length > 0) {
        const inactiveMessages = inactiveParticipants.map(
          (inactiveParticipants) => ({
            from: inactiveParticipants.name,
            to: "Todos",
            text: "sai da sala...",
            type: "status",
            time: dayjs().format("HH:MM:SS"),
          })
        );

        await db.collection("messages").insertMany(inactiveMessages);
        await db
          .collection("participants")
          .deleteMany({ lastStatus: { $lte: seconds } });
      }
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  }, TIME_TO_CHECK);

  server.listen(5000, () => {
    console.log("O servidor subiu na porta 5000");
  });
}

main().catch(console.error);
