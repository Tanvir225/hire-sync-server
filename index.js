const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const port = 5000;
//dot env
require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//middleware
app.use(
  cors({
    origin: ["http://localhost:5173","https://hire-sync-96ea5.web.app","https://hire-sync-96ea5.firebaseapp.com"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

//custom middleware
const logger = async (req, res, next) => {
  console.log(`Request made to ${req.method} at ${req.url}`);
  next();
};

//verify token
const verfyToken = async (req, res, next) => {
  //get token from cookie
  const token = req?.cookies?.token;
  console.log(token);
  if (!token) {
    return res.status(401).send({ status: "unauthorised" });
  }

  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
      if (err) {
        return res.status(403).send({ status: "forbidden" });
      }

      req.user = decoded;
      next();
    });
  }
};

//test api
app.get("/", async (req, res) => {
  res.send("welcome to hire-sync");
});

//username -> hire-sync
//pass -> d80nrh2xWJTpkkCJ

const uri =
  `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.ljq2tzl.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
   // await client.connect();

    //connect to databse
    const database = client.db("hiresyncDB");
    const jobs = database.collection("jobs");
    const categories = database.collection("categories");
    const appliedJob = database.collection("appliedJob");

    //jwt auth related api -> v1
    app.post("/api/v1/jwt", async (req, res) => {
      //user from body
      const user = req.body;
      //console.log(user);
      //token generate
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite:'none'
        })
        .send({ status: true });
    });

    //category api endpoint -> v1
    app.get("/api/v1/category", async (req, res) => {
      const result = await categories.find().toArray();
      res.send(result);
    });

    //jobs api endpoint -> v1
    //usage this-api -> /api/v1/jobs?email="t@gmail.com &search="title" - case-1
    //usage this-api -> /api/v1/jobs - case-2

    app.get("/api/v1/jobs", logger, verfyToken, async (req, res) => {
      //get user from cookie
      const user = req?.user;

      //get queryEmail
      const { email } = req.query;
      const { search } = req.query;
      //queryObj
      const queryObj = {};

      if (email) {
        if (user?.email === email) {
          console.log("match");
          queryObj.email = email;
        }
      } else {
        return res.send({ status: "unauthorized" });
      }

      if (search) {
        queryObj.title = { $regex: search, $options: "i" };
      }

      //console.log(queryObj);

      const result = await jobs.find(queryObj).toArray();

      return res.send(result);
    });

    //jobCountfor pagination api endpoint
    app.get("/api/v1/jobsCount", async (req, res) => {
      const count = await jobs.estimatedDocumentCount();
      res.send({ count });
    });

    //countdown
    app.get("/api/v1/countDown",async(req,res)=>{
      const jobCount = await jobs.estimatedDocumentCount()
      const applyCount = await appliedJob.estimatedDocumentCount()
      const categoryCount = await categories.estimatedDocumentCount()

      return res.send({jobCount,applyCount,categoryCount})
    })

    //exclude job by user-email
    //usage this-api -> /api/v1/jobs/exclude/home?email="t@gmail.com&category&page-
    app.get("/api/v1/jobs/exclude/home", async (req, res) => {
      const { email } = req.query;
      const { category } = req.query;

      //jobObj
      let jobObj = {};
      //get all the jobs from db and filter out the ones is not match with the given email
      if (email) {
        jobObj["email"] = { $ne: email };
      }

      if (category) {
        jobObj.category = category;
      }

      const result = await jobs
        .find(jobObj)
        .limit(6)
        .toArray();
      res.send(result);

    });

    //exclude job by user email
    //usage this-api -> /api/v1/jobs/exclude?email="t@gmail.com&search=""&category&page&size- case-1
    //usage this-api -> /api/v1/jobs/exclude - case-2

    app.get("/api/v1/jobs/exclude", async (req, res) => {
      const { email } = req.query;
      const { search } = req.query;
      const { category } = req.query;
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);

     // console.log(page, size);
      //jobObj
      let jobObj = {};
      //get all the jobs from db and filter out the ones is not match with the given email
      if (email) {
        jobObj["email"] = { $ne: email };
      }

      if (search) {
        jobObj.title = { $regex: search, $options: "i" };
      }

      if (category) {
        jobObj.category = category;
      }

     // console.log(jobObj);
      const result = await jobs
        .find(jobObj)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    //single job api endpoint -> v1
    app.get("/api/v1/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const result = await jobs.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    //apply jobs api endpoint -> v1
    //usage this-api -> /api/v1/apply?email="t@gmail.com&search=""&category=""- case-1
    //usage this-api -> /api/v1/apply - case-2

    app.get("/api/v1/apply", logger, verfyToken, async (req, res) => {
      //get user from cookie
      const user = req?.user;

      //let result
      let result;

      //get queryEmail
      const { email } = req.query;
      const { search } = req.query;
      const { category } = req.query;
      //queryObj
      const queryObj = {};

      if (email) {
        if (user?.email === email) {
          if (email) {
            queryObj.userEmail = email;
          }
        }
      } else {
        return res.send({ status: "unauthorised" });
      }

      if (search) {
        queryObj.position = { $regex: search, $options: "i" };
      }
      if (category) {
        queryObj.category = category;
      }

      result = await appliedJob.find(queryObj).toArray();
      return res.send(result);
    });

    // jobs post api endpoint -> v1
    app.post("/api/v1/jobs", async (req, res) => {
      const job = req.body;
      console.log(job);
      const result = await jobs.insertOne(job);
      res.send(result);
    });

    //apply post api endpoint ->
    app.post("/api/v1/apply", async (req, res) => {
      let result;
      const {
        userName,
        userEmail,
        position,
        resumeLink,
        id,
        company,
        salary,
        category,
      } = req.body;

      //console.log(id, userEmail);

      const job = await jobs.findOne({ _id: new ObjectId(id) });

      // Check if the user who posted the job is trying to apply
      if (job.email === userEmail) {
        //console.log("you can't apply");
        return res.send({ error: "You can't apply!" });
      }

      // Check if the apply deadline is over
      if (new Date(job.appDeadline) < new Date()) {
        //console.log("Apply deadline is over!");
        return res.send({ error: "Apply deadline is over!" });
      }

      //check for user apply or not
      const userApplied = await appliedJob.findOne({ id: id });
      console.log(userApplied);

      if (userApplied?.userEmail.includes(userEmail)) {
        return res.send({ error: "you have already applied" });
      }

      //save apply
      result = await appliedJob.insertOne(req.body);

      //process job application
      // Save the updated job document
      result = await jobs.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { applicantNumber: 1 } }
      );

      return res.send({ success: "Application successful", result });
    });

    //job update api endpoint -> v1
    app.patch("/api/v1/jobs/update/:id", async (req, res) => {
      const id = req.params.id;
      const job = req.body;
      //console.log(job);
      //filter
      const filter = { _id: new ObjectId(id) };

      //updatedJob
      const updatedJob = {
        $set: job,
      };

      //options
      const options = { upsert: true };

      const result = await jobs.updateOne(filter, updatedJob, options);
      res.send(result);
    });

    // job delete api endpoint -> v1
    app.delete("/api/v1/jobs/delete/:id", async (req, res) => {
      const id = req.params.id;
      //console.log(id);
      const result = await jobs.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

//port
app.listen(port, () => {
  console.log(`your server is running on port : ${port}`);
});
