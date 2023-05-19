const fs = require("fs");
const bodyParser = require("body-parser");
const jsonServer = require("json-server");
var express = require("express");
const jwt = require("jsonwebtoken");
var app = express();
var cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();
const multer = require("multer");
const path = require("path");

app.use(cors());
app.use(express.static(process.cwd() + "public"));

const server = jsonServer.create();
const router = jsonServer.router("./database.json");
const userdb = JSON.parse(fs.readFileSync("./users.json", "UTF-8"));

server.use(bodyParser.urlencoded({ extended: true }));
server.use(bodyParser.json());
server.use(jsonServer.defaults());

function getUser(id) {
  const userdb = JSON.parse(fs.readFileSync("./users.json", "UTF-8"));
  const user = userdb.users.filter((user) => String(user.id) === String(id));
  return user;
}

function findIndexOfUser(id) {
  const userdb = JSON.parse(fs.readFileSync("./users.json", "UTF-8"));
  const idx = userdb.users.findIndex((user) => String(user.id) === String(id));
  return idx;
}
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public");
  },
  filename: function (req, file, cb) {
    const { id } = req.params;
    const user = getUser(id);
    file_name = user[0].username + "-Avatar.jpg";
    cb(null, String(file_name));
  },
});

var upload = multer({ storage: storage });

const SECRET_KEY = "123456789";

const expiresIn = "1h";

// Create a token from a payload
function createToken(payload) {
  return jwt.sign(payload, SECRET_KEY, { expiresIn });
}

// Verify the token
function verifyToken(token) {
  return jwt.verify(token, SECRET_KEY, (err, decode) =>
    decode !== undefined ? decode : err
  );
}

// Check if the user exists in database
function isAuthenticated({ email, password }) {
  const index = userdb.users.findIndex(
    (user) => user.email === email && user.password === password
  );
  return index;
}

function isEmailExist(email) {
  const index = userdb.users.findIndex((user) => user.email === email);
  return index;
}
// Register New User
server.post("/auth/register", (req, res) => {
  const { email, password, position, username, address, active, role } =
    req.body;

  if (isAuthenticated({ email, password }) === true) {
    const status = 401;
    const message = "Email and Password already exist";
    res.status(status).json({ status, message });
    return;
  }

  fs.readFile("./users.json", (err, data) => {
    if (err) {
      const status = 401;
      const message = err;
      res.status(status).json({ status, message });
      return;
    }

    // Get current users data
    var data = JSON.parse(data.toString());

    // Get the id of last user
    var last_item_id = data.users[data.users.length - 1].id;
    const lastLoginTime = new Date(Date.now());
    //Add new user
    data.users.push({
      id: last_item_id + 1,
      email: email,
      position: position,
      username: username,
      address: address,
      active: active,
      role: role,
      password: password,
      lastLogin: lastLoginTime.toLocaleString(),
    }); //add some data
    var writeData = fs.writeFile(
      "./users.json",
      JSON.stringify(data),
      (err, result) => {
        // WRITE
        if (err) {
          const status = 401;
          const message = err;
          res.status(status).json({ status, message });
          return;
        }
      }
    );
  });

  // Create token for new user
  const access_token = createToken({ email, password });
  res.status(200).json({ access_token });
});

server.post("/auth/registersubadmin", (req, res) => {
  const { email, password, position, username, address, active, role } =
    req.body;
  const subadmin = JSON.parse(fs.readFileSync("./users.json", "UTF-8"));

  if (isAuthenticated({ email, password }) === true) {
    const status = 401;
    const message = "Email and Password already exist";
    res.status(status).json({ status, message });
    return;
  }

  fs.readFile("./users.json", (err, data) => {
    if (err) {
      const status = 401;
      const message = err;
      res.status(status).json({ status, message });
      return;
    }

    // Get current users data
    var data = JSON.parse(data.toString());

    // Get the id of last user
    var last_item_id = subadmin.users[data.users.length - 1].id;
    const lastLoginTime = new Date(Date.now());

    //Add new user
    data.users.push({
      id: last_item_id + 1,
      email: email,
      position: position,
      username: username,
      address: address,
      active: active,
      role: role,
      password: password,
      lastLogin: lastLoginTime.toLocaleString(),
    }); //add some data
    var writeData = fs.writeFile(
      "./users.json",
      JSON.stringify(data),
      (err, result) => {
        // WRITE
        if (err) {
          const status = 401;
          const message = err;
          res.status(status).json({ status, message });
          return;
        }
      }
    );
  });

  // Create token for new user
  const access_token = createToken({ email, password });
  res.status(200).json({ access_token });
});
// Login to one of the users from ./users.json
server.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  console.log(password);
  const result = isAuthenticated({ email, password });
  if (String(result) === "-1") {
    const status = 401;
    const message = "Incorrect email or password";
    res.status(status).json({ status, message });
    return;
  }

  fs.readFile("./users.json", (err, data) => {
    if (err) {
      const status = 401;
      const message = err;
      return res.status(status).json({ status, message });
    }

    // Get current users data
    var data = JSON.parse(data.toString());
    const currUser = data.users[result];
    const lastLoginTime = new Date(Date.now());
    data.users[result] = {
      ...data.users[result],
      lastLogin: lastLoginTime.toLocaleString()?.slice(0, 9),
    };

    var writeData = fs.writeFile(
      "./users.json",
      JSON.stringify(data),
      (err, result) => {
        // WRITE
        if (err) {
          const status = 401;
          const message = err;
          res.status(status).json({ status, message });
          return;
        }
      }
    );
  });
  const access_token = createToken({ email, password });
  res.status(200).json({ access_token, userData: userdb.users[result] });
});
// Delete user endpoints
server.delete("/delete/:id", (req, res) => {
  const deleteUser = JSON.parse(fs.readFileSync("./users.json", "UTF-8"));

  const { id } = req.params;
  const filteredData = deleteUser.users.filter(
    (user) => String(user.id) !== String(id)
  );
  fs.readFile("./users.json", (err, data) => {
    if (err) {
      const status = 401;
      const message = err;
      res.status(status).json({ status, message });
      return;
    }

    // Get current users data
    let users = JSON.parse(data.toString());
    users.users = filteredData;
    var writeData = fs.writeFile(
      "./users.json",
      JSON.stringify(users),
      (err, result) => {
        // WRITE
        if (err) {
          const status = 401;
          const message = err;
          res.status(status).json({ status, message });
          return;
        }
        res.json(users);
      }
    );
  });
});

server.get("/getall", (req, res) => {
  const userdata = JSON.parse(fs.readFileSync("./users.json", "UTF-8"));
  try {
    const data = userdata.users;
    res.status(200).json({ data });
  } catch (e) {
    console.log(e.toString());
  }
});

server.get("/getallusers", (req, res) => {
  const userdata = JSON.parse(fs.readFileSync("./users.json", "UTF-8"));
  try {
    const data = userdata.users.filter((user) => user.role === "user");
    res.status(200).json({ data });
  } catch (e) {
    console.log(e.toString());
  }
});

server.get("/getallsubadmins", (req, res) => {
  const subadmin = JSON.parse(fs.readFileSync("./users.json", "UTF-8"));

  try {
    const data = subadmin.users.filter((user) => user.role === "subadmin");
    res.status(200).json({ data });
  } catch (e) {
    console.log(e.toString());
  }
});

server.get("/getroles", (req, res) => {
  try {
    const data = userdb.roles;
    res.status(200).json(data);
  } catch (e) {
    console.log(e.toString());
  }
});

server.put("/updateusers/:id", (req, res) => {
  const { id } = req.params;

  try {
    const index = userdb.users.findIndex(
      (user) => String(user.id) === String(id)
    );

    fs.readFile("./users.json", (err, data) => {
      if (err) {
        const status = 401;
        const message = err;
        res.status(status).json({ status, message });
        return;
      }

      // Get current users data
      var data = JSON.parse(data.toString());
      const currUser = data.users[index];
      data.users[index] = {
        email: req.body?.email,
        password: req.body?.password,
        username: req.body?.username,
        active: req.body?.active,
        position: req.body?.position,
        address: req.address,
        role: req.body?.role,
        id: index === 0 ? 1 : userdb.users[index - 1].id + 1,
        confirmpassword: req.body?.confirmpassword,
        lastLogin: data.users[index]?.lastLogin,
      };

      var writeData = fs.writeFile(
        "./users.json",
        JSON.stringify(data),
        (err, result) => {
          // WRITE
          if (err) {
            const status = 401;
            const message = err;
            res.status(status).json({ status, message });
            return;
          }
        }
      );
    });
    res.sendStatus(200);
  } catch (e) {
    console.log(e.toString());
  }
});

server.get("/users/:id", (req, res) => {
  const { id } = req.params;
  const index = userdb.users.findIndex(
    (user) => String(user.id) === String(id)
  );
  const currentUser = userdb.users[index];

  res.status(200).json(currentUser);
});

server.put("/updatepassword/:id", (req, res) => {
  const { id } = req.params;
  const { newPass, currPassword } = req.body;
  console.log(req.body, "body");
  const index = userdb.users.findIndex(
    (user) => String(user.id) === String(id)
  );

  const userPassword = userdb.users[index]?.password;
  console.log(userPassword, "userPassword", currPassword, "currPassword");
  if (userPassword !== currPassword) {
    console.log("not Equal");
    const status = 401;
    const message = "Wrong password";
    res.status(status).json({ status, message });
    return;
  }
  fs.readFile("./users.json", (err, data) => {
    if (err) {
      const status = 401;
      const message = err;
      res.status(status).json({ status, message });
      return;
    }

    // Get current users data
    var data = JSON.parse(data.toString());
    const currUser = data.users[index];
    data.users[index] = {
      ...currUser,
      password: newPass,
      confirmpassword: newPass,
    };
    var writeData = fs.writeFile(
      "./users.json",
      JSON.stringify(data),
      (err, result) => {
        // WRITE
        if (err) {
          const status = 401;
          const message = err;
          res.status(status).json({ status, message });
          return;
        }
      }
    );
  });
  res.sendStatus(200);
});

server.put("/updateuserrights", (req, res) => {
  console.log(req.body, "body");

  try {
    fs.readFile("./users.json", (err, data) => {
      if (err) {
        const status = 401;
        const message = err;
        res.status(status).json({ status, message });
        return;
        u;
      }

      // Get current users data
      var data = JSON.parse(data.toString());
      data.roles.users = {
        edit_basic_details: req.body?.edit_basic_details,
        edit_credentials: req.body?.edit_credentials,
        delete: req.body?.delete,
      };
      var writeData = fs.writeFile(
        "./users.json",
        JSON.stringify(data),
        (err, result) => {
          // WRITE
          if (err) {
            const status = 401;
            const message = err;
            res.status(status).json({ status, message });
            return;
          }
        }
      );
    });
    res.sendStatus(200);
  } catch (e) {
    console.log(e.toString());
  }
});

server.put("/updatesubadminrights", (req, res) => {
  console.log(req.body, "adminRights");
  try {
    fs.readFile("./users.json", (err, data) => {
      if (err) {
        const status = 401;
        const message = err;
        res.status(status).json({ status, message });
        return;
      }

      // Get current users data
      var data = JSON.parse(data.toString());
      data.roles.subAdmin = {
        own_rights: {
          edit: req.body?.own_rights?.edit,
        },
        users: {
          edit: req.body?.users?.edit,
          create: req.body?.users?.create,
          delete: req.body?.users?.delete,
          view: req.body?.users?.view,
        },
        sub_admin: {
          edit: req.body?.sub_admin?.edit,
          delete: req.body?.sub_admin?.delete,
          view: req.body?.sub_admin?.view,
        },
      };
      var writeData = fs.writeFile(
        "./users.json",
        JSON.stringify(data),
        (err, result) => {
          console.log(result, "result");
          // WRITE
          if (err) {
            const status = 401;
            const message = err;
            res.status(status).json({ status, message });
            return;
          }
        }
      );
    });
    res.sendStatus(200);
  } catch (e) {
    console.log(e.toString());
  }
});

server.post("/forgetpassword", cors(), (req, res) => {
  const { email } = req.body;
  console.log(email);
  const result = isEmailExist(email);
  if (String(result) === "-1") {
    const status = 401;
    const message = "Incorrect email or password";
    res.status(status).json({ status, message });
    return;
  }

  fs.readFile("./users.json", (err, data) => {
    if (err) {
      const status = 401;
      const message = err;
      return res.status(status).json({ status, message });
    }

    // Get current users data
    var data = JSON.parse(data.toString());
    const currUser = data.users[result];
    const userObj = {
      email: currUser.email,
      password: currUser.password,
      username: currUser.username,
    };
    SendForgetPasswordMail(userObj) ? res.sendStatus(200) : res.sendStatus(401);
  });
});

server.post(
  "/profile/:id",
  upload.single("avatar"),
  async function (req, res, next) {
    console.log(req.file);
    const { id } = req.params;
    const index = findIndexOfUser(id);
    fs.readFile("./users.json", (err, data) => {
      if (err) {
        const status = 401;
        const message = err;
        res.status(status).json({ status, message });
        return;
      }

      // Get current users data
      var data = JSON.parse(data.toString());
      const currUser = data.users[index];
      data.users[index] = {
        ...currUser,
        profilePath: currUser.username + "-Avatar.jpg",
      };
      var writeData = fs.writeFile(
        "./users.json",
        JSON.stringify(data),
        (err, result) => {
          // WRITE
          if (err) {
            const status = 401;
            const message = err;
            res.status(status).json({ status, message });
            return;
          }
        }
      );
    });
    return res.sendStatus(200);
  }
);

async function SendForgetPasswordMail({ email, password, username }) {
  let mailTransporter = nodemailer.createTransport({
    service: "gmail",
    port: 587,
    auth: {
      user: process.env.USER_NAME,
      pass: process.env.USER_PASS,
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

server.use(/^(?!\/auth).*$/, (req, res, next) => {
  if (
    req.headers.authorization === undefined ||
    req.headers.authorization.split(" ")[0] !== "Bearer"
  ) {
    const status = 401;
    const message = "Error in authorization format";
    res.status(status).json({ status, message });
    return;
  }
  try {
    let verifyTokenResult;
    verifyTokenResult = verifyToken(req.headers.authorization.split(" ")[1]);

    if (verifyTokenResult instanceof Error) {
      const status = 401;
      const message = "Access token not provided";
      res.status(status).json({ status, message });
      return;
    }
    next();
  } catch (err) {
    const status = 401;
    const message = "Error access_token is revoked";
    res.status(status).json({ status, message });
  }
});

server.use(router);

server.listen(8000, () => {
  console.log("Run Auth API Server");
});
