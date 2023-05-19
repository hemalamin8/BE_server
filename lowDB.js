import { join, dirname } from "node:path";
import express from "express";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { JSONFile, JSONFileSync } from "lowdb/node";
import jwt from "jsonwebtoken";
import { Low } from "lowdb";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import multer from "multer";
import { unlinkSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, "database.json");

const adapter = new JSONFile(file);
var defaultData = {
  users: [
    {
      email: "josh@gmail.com",
      password: "hemal",
      username: "John",
      active: false,
      position: "Manager",
      role: "admin",
      id: 1,
      confirmpassword: "hemal",
      lastLogin: "5/12/2023",
      profilePath: "John-Avatar.jpg",
    },
  ],
  roles: {
    users: {
      edit_basic_details: false,
      edit_credentials: false,
      delete: false,
    },
    subAdmin: {
      own_rights: { edit: false },
      users: { edit: false, create: false, delete: false, view: false },
      sub_admin: { edit: false, delete: false, view: false },
    },
  },
};

const db = new Low(adapter, defaultData);
var app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

async function isAuthenticated({ email, password }) {
  await db.read();
  return (
    db.data.users.findIndex(
      (user) => user.password === password && user.email === email
    ) !== -1
  );
}

async function isEmailExist(email) {
  await db.read();
  const index = db.data.users.findIndex((user) => user.email === email) !== -1;
  return index;
}

async function getIndex({ email }) {
  await db.read();
  const index = db.data.users.findIndex((user) => user.email === email);
  return index;
}

async function SendForgetPasswordMail({ email, password, username }) {
  let mailTransporter = nodemailer.createTransport({
    service: "gmail",
    port: 587,
    auth: {
      user: dotenv.config().parsed.USER_NAME,
      pass: dotenv.config().parsed.USER_PASS,
    },
    secure: true,
  });

  let mailDetails = {
    from: process.env.USER_NAME,
    to: email,
    subject: "Your Password",
    html: `<h1>Hello ${username} </h1> <h3>Your Current password is <b>${password}<b></h3><br><h4>If you want to change your password then loggin to the .... and then navigate to <i>profile(top right corner) > Manage Account > Change Password<i></h4>.`,
  };

  mailTransporter.sendMail(mailDetails, function (err, data) {
    if (err) {
      console.log("Error Occurs", err);
      return false;
    } else {
      console.log("Email sent successfully");
      return true;
    }
  });
}

async function findIndexOfUser(id) {
  await db.read();
  const idx = db.data.users.findIndex((user) => String(user.id) === String(id));
  return idx;
}

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public");
  },
  filename: async function (req, file, cb) {
    const { id } = req.params;
    const user = await getUser(id);
    const file_name =
      user[0].username + "-Avatar-" + Date.now().toString() + ".jpg";
    cb(null, String(file_name));
  },
});

var upload = multer({ storage: storage });

async function getUser(id) {
  await db.read();
  const user = db.data.users.filter((user) => String(user.id) === String(id));
  return user;
}

const SECRET_KEY = "123456789";
const expiresIn = "1h";

function createToken(payload) {
  return jwt.sign(payload, SECRET_KEY, { expiresIn });
}

app.post("/auth/register", async (req, res) => {
  const { email, password, position, username, address, active, role } =
    req.body;
  await db.read();

  if (await isAuthenticated({ email, password })) {
    const status = 401;
    const message = "Email and password already exist";
    res.status(status).json({ status, message });
    return;
  }
  try {
    const index = db.data.users.length;
    const lastLoginTime = new Date(Date.now());
    db.data.users.push({
      email,
      password,
      position,
      username,
      address,
      active,
      role,
      id: index === 0 ? 1 : db.data.users[index - 1]?.id + 1,
      lastLogin: lastLoginTime.toLocaleString(),
    });
    db.write();
    const access_token = createToken({ email, password });
    res.status(200).json({ access_token });
  } catch (error) {
    throw new Error(error.toString());
  }
});

app.post("/auth/registersubadmin", async (req, res) => {
  const { email, password, position, username, address, active, role } =
    req.body;
  await db.read();

  if (!(await isAuthenticated({ email, password }))) {
    const status = 401;
    const message = "Email and password already exist";
    res.status(status).json({ status, message });
    return;
  }
  try {
    const index = db.data.users.length;
    const lastLoginTime = new Date(Date.now());
    db.data.users.push({
      email,
      password,
      position,
      username,
      address,
      active,
      role,
      id: index === 0 ? 1 : db.data.users[index - 1]?.id + 1,
      lastLogin: lastLoginTime.toLocaleString(),
    });
    db.write();
    res.sendStatus(200);
  } catch (error) {
    throw new Error(error.toString());
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!(await isAuthenticated({ email, password }))) {
    const status = 401;
    const message = "Incorrect email or password";
    res.status(status).json({ status, message });
    return;
  }
  try {
    const index = await getIndex({ email });
    const user = db.data.users[index];
    const lastLoginTime = new Date(Date.now());
    user.lastLogin = lastLoginTime.toLocaleString()?.slice(0, 9);
    db.write();
    const access_token = createToken({ email, password });
    res.status(200).json({ access_token, userData: user });
  } catch (error) {
    throw new Error(error.toString());
  }
});

app.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.read();
    const fileteredUsers = db.data.users.filter((user) => user.id != id);

    db.data.users = fileteredUsers;
    db.write();
    res.status(200).json({ fileteredUsers });
  } catch (error) {
    throw new Error(error.toString());
  }
});

app.get("/getall", async (req, res) => {
  try {
    await db.read();
    const data = db.data.users;
    res.status(200).json({ data });
  } catch (e) {
    throw new Error(e.toString());
  }
});

app.get("/getallusers", async (req, res) => {
  try {
    await db.read();
    const users = db.data.users.filter(
      (user) => user.role === dotenv.config().parsed.ROLE_TWO
    );
    res.status(200).json({ users });
  } catch (error) {
    throw new Error(error.toString());
  }
});

app.get("/getallsubadmins", async (req, res) => {
  try {
    await db.read();
    const subadmins = db.data.users.filter(
      (user) => user.role === dotenv.config().parsed.ROLE_THREE
    );
    res.status(200).json({ subadmins });
  } catch (error) {
    throw new Error(error.toString());
  }
});

app.get("/getroles", (req, res) => {
  try {
    db.read();
    const roles = db.data.roles;
    res.status(200).json({ roles });
  } catch (error) {
    throw new Error(error.toString());
  }
});

app.put("/updateusers/:id", async (req, res) => {
  const { id } = req.params;
  const {
    email,
    password,
    username,
    active,
    position,
    address,
    role,
    confirmpassword,
  } = req.body;

  try {
    await db.read();
    const index = db.data.users.findIndex(
      (user) => String(user.id) === String(id)
    );

    const user = db.data.users[index];
    db.data.users[index] = {
      username,
      email,
      active,
      position,
      address,
      confirmpassword,
      role,
      password,
      lastLogin: user?.lastLogin,
      id: user.id,
    };
    db.write();
    res.sendStatus(200);
  } catch (error) {
    throw new Error(error.toString());
  }
});

app.get("/users/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.read();
    const index = db.data.users.findIndex(
      (user) => String(user.id) === String(id)
    );
    const currentUser = db.data.users[index];
    res.status(200).json(currentUser);
  } catch (error) {
    throw new Error(error.toString());
  }
});

app.put("/updatepassword/:id", async (req, res) => {
  const { id } = req.params;
  const { newPass, currPassword } = req.body;

  try {
    await db.read();
    const index = db.data.users.findIndex(
      (user) => String(user.id) === String(id)
    );

    const user = db.data.users[index];
    if (user.password !== currPassword) {
      const status = 401;
      const message = "Wrong Password";
      res.status(status).json({ status, message });
      return;
    }

    db.data.users[index] = {
      ...user,
      password: newPass,
      confirmpassword: newPass,
    };
    db.write();
    res.sendStatus(200);
  } catch (error) {
    throw new Error(error.toString());
  }
});

app.put("/updateuserrights", async (req, res) => {
  const { edit_basic_details, edit_credentials } = req.body;
  try {
    await db.read();
    db.data.roles.users = {
      edit_basic_details,
      edit_credentials,
      delete: req.body.delete,
    };
    db.write();
    res.sendStatus(200);
  } catch (error) {
    throw new Error(error.toString());
  }
});

app.put("/updatesubadminrights", async (req, res) => {
  try {
    await db.read();
    db.data.roles.subAdmin = {
      own_rights: {
        edit: req.body?.own_rights.edit,
      },
      users: {
        edit: req.body?.users.edit,
        delete: req.body?.users?.delete,
        create: req.body?.users?.create,
        view: req.body?.users?.view,
      },
      sub_admin: {
        edit: req.body?.sub_admin?.edit,
        delete: req.body?.sub_admin?.delete,
        view: req.body?.sub_admin?.view,
      },
    };
    db.write();
    res.sendStatus(200);
  } catch (error) {
    throw new Error(error, toString());
  }
});

app.post("/forgetpassword", cors(), async (req, res) => {
  const { email } = req.body;
  if (!isEmailExist(email)) {
    const status = 401;
    const message = "Incorrect email";
    res.status(status).json({ status, message });
    return;
  }
  try {
    const index = await getIndex({ email });
    await db.read();
    const user = db.data.users[index];
    const emailData = {
      email: email,
      password: user.password,
      username: user.username,
    };
    SendForgetPasswordMail(emailData)
      ? res.sendStatus(200)
      : res.sendStatus(401);
  } catch (e) {
    throw new Error(e.toString());
  }
});

// app.delete("/deleteprofile", async (req, res) => {
//   const { id } = req.params;
//   const currUser = getUser(id);
//   const pathName = __dirname + "/public/" + currUser.username;
//   pathName.includes(currUser.username);
// });
app.post(
  "/profile/:id",
  upload.single("avatar"),
  async function (req, res, next) {
    const { id } = req.params;
    const index = await findIndexOfUser(id);
    try {
      await db.read();
      console.log(req.file.filename, "filename");
      const currUser = db.data.users[index];
      db.data.users[index] = {
        ...currUser,
        profilePath: req.file.filename,
      };
      db.write();
      res.status(200).json(req.file.filename);
    } catch (error) {
      throw new Error(error.toString());
    }
  }
);

// app.use(/^(?!\/auth).*$/, (req, res, next) => {
//   if (
//     req.headers.authorization === undefined ||
//     req.headers.authorization.split(" ")[0] !== "Bearer"
//   ) {
//     const status = 401;
//     const message = "Error in authorization format";
//     res.status(status).json({ status, message });
//     return;
//   }
//   try {
//     let verifyTokenResult;
//     verifyTokenResult = verifyToken(req.headers.authorization.split(" ")[1]);

//     if (verifyTokenResult instanceof Error) {
//       const status = 401;
//       const message = "Access token not provided";
//       res.status(status).json({ status, message });
//       return;
//     }
//     next();
//   } catch (err) {
//     const status = 401;
//     const message = "Error access_token is revoked";
//     res.status(status).json({ status, message });
//   }
// });

app.listen( dotenv.config().parsed.PORT, function () {
  console.log("Listening on port");
});
