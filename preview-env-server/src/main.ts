import express, { type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();
const app = express();

app.use(cors());

app.get("/authorize", async (req: Request, res: Response) => {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;
    const scope = "repo"; // what to do for full public and private both access this only allows for private ones
    const githubUri = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;

    res.json({ githubUri });
  } catch (err: any) {
    res.json({ error: "error" });
  }
});

app.get("/auth/github/callback", async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    const exchange = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      },
    );
    console.log(exchange);
    res.redirect("/home");
  } catch (err: any) {
    console.log(err);
    res.json({ error: "error" });
  }
});

app.listen(8080, () => {
  console.log("server running");
});
