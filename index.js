const express = require('express');
const cors = require('cors');
const app = express()
const port = 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

//middleware
app.use(cors())
app.use(express.json())

//test api
app.get("/",async(req,res)=>{
    res.send("welcome to hire-sync")
})

//username -> hire-sync
//pass -> d80nrh2xWJTpkkCJ

const uri = "mongodb+srv://hire-sync:d80nrh2xWJTpkkCJ@cluster0.ljq2tzl.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //connect to databse
    const database = client.db("hiresyncDB")
    const jobs = database.collection("jobs")
    const categories = database.collection("categories")


    //category api endpoint -> v1
    app.get("/api/v1/category",async(req,res)=>{
        const result = await categories.find().toArray()
        res.send(result)
    })

    //jobs api endpoint -> v1
    //usage this-api -> /api/v1/jobs?email="t@gmail.com" - case-1
    app.get("/api/v1/jobs",async(req,res)=>{

      //get queryEmail
      const {email} = req.query
      const {search} = req.query
      //queryObj
      const queryObj = {}

      if (email) {
        queryObj.email = email
      }
      if (search) {
        queryObj.title = {$regex :search , $options : 'i'}
      }
      //console.log(queryObj);
      
      const result = await jobs.find(queryObj).toArray()

      // //filter by email
      // if (email) {
      //   result = await jobs.find({email : email}).toArray()
      // }
      // else{
      //   result = await jobs.find().toArray()
      // }
        
        res.send(result)
    })

    // jobs post api endpoint -> v1
    app.post("/api/v1/jobs",async(req,res)=>{
        const job = req.body
        console.log(job);
        const result = await jobs.insertOne(job)
        res.send(result)
    })

    //job update api endpoint -> v1
    app.patch("/api/v1/jobs/update/:id",async(req,res)=>{
      const id = req.params.id
      const job = req.body
      console.log(id,job);
    })

    // job delete api endpoint -> v1
    app.delete("/api/v1/jobs/delete/:id",async(req,res)=>{
      const id = req.params.id
      //console.log(id);
      const result = await jobs.deleteOne({_id : new ObjectId(id)})
      res.send(result)
    })

    



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


//port
app.listen(port,()=>{
    console.log(`your server is running on port : ${port}`);
})