import express, { type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { prisma } from "./lib/prisma.js";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { spawn } from "node:child_process";
import path from "node:path";
dotenv.config();
const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true
  })
);
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
        code
      },
      {
        headers: {
          Accept: "application/json"
        }
      }
    );
    console.log(exchange.data);
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${exchange.data.access_token}`,
        Accept: "application/vnd.github+json"
      }
    });

    console.log(userResponse.data);
    const user = await prisma.user.create({
      data: {
        githubUsername: userResponse.data.login,
        accessToken: exchange.data.access_token,
        githubUserId: userResponse.data.id
      }
    });

    const token = jwt.sign({ userId: user.id }, process.env.SECRET_KEY!, {
      expiresIn: "7d"
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.redirect(`http://localhost:3000/home`);
  } catch (err: any) {
    console.log(err);
    res.json({ error: "error" });
  }
});

app.get("/repos", async (req: Request, res: Response) => {
  try {
    const token = req.cookies.token;
    console.log(token);
    const paylod = jwt.verify(token, process.env.SECRET_KEY!) as any;
    const id = paylod.userId;
    const user = await prisma.user.findUnique({ where: { id: Number(id) } });
    const reposResponse = await axios.get("https://api.github.com/user/repos", {
      headers: {
        Authorization: `Bearer ${user?.accessToken}`,
        Accept: "application/vnd.github+json"
      }
    });

    console.log(reposResponse);
    res.json({ data: reposResponse.data });
  } catch (err: any) {
    console.log(err);
    res.json({ error: "error" });
  }
});

const runCommand = async (command: string, args: string[], options: {}) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: true,
      stdio: "inherit",
      ...options
    });

    child.on("close", (code) => {
      if (code == 0) {
        resolve("project dployed");
      } else {
        reject("failed to deploy");
      }
    });
    child.on("err", (err) => {
      reject(err);
    });
  });
};

app.post("/deploy", async (req: Request, res: Response) => {
  try {
    console.log(req.body);

    const repoUrl = req.body.repoUrl;
    const buildName = req.body.buildName.toLowerCase();
    const workSpace = path.join(__dirname, "temp_repos");
    const projDir = path.join(workSpace, "vite-project");
    await runCommand("git", ["clone", repoUrl, workSpace], {});
    await runCommand("docker", ["build", "-t", buildName, "."], {
      cwd: projDir
    });
    await runCommand("docker", ["run", "-d", "-p", "4173:4173", buildName], {});

    res.json({ url: repoUrl, deployedURl: "http://localhost:4173" });
  } catch (err: any) {
    console.log(err);
  }
});

app.listen(8080, () => {
  console.log("server running");
});
