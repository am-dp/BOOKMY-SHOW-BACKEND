const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const dotenv = require("dotenv").config();
const URL = process.env.DB;

const DB_NAME = "movie_db";
const COLLECTION_NAME = "movies";

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/movie/get-movies", async (req, res) => {
  try {
    const client = new MongoClient(URL, {});
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    const movies = await collection.find({}).toArray();
    await client.close();
    res.json(movies);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.get("/movie/:id", async (req, res) => {
  try {
    const id = req.params.id;
    console.log("Received request for movie ID:", id); // Log the requested ID

    // Check if the provided ID is a valid format (as string)
    if (typeof id !== "string" || id.length !== 24) {
      return res.status(400).json({ message: "Invalid movie ID format" });
    }

    const client = await new MongoClient(URL).connect();
    let db = client.db(DB_NAME);
    let dbcollection = await db.collection(COLLECTION_NAME);

    console.log("Querying movie with ID:", id); // Log the query

    // Querying by _id as a string
    let movie = await dbcollection.findOne({ _id: id });
    await client.close();

    if (!movie) {
      return res.status(404).json({ message: "Requested movie is not found" });
    }

    res.json(movie);
  } catch (error) {
    console.error("Error occurred:", error); // Log specific error
    res.status(500).json({ message: error.message || "Something went wrong" }); // Return specific error message
  }
});

app.post("/movie/book-movie", async (req, res) => {
  let bookingRequest = req.body;

  // Debugging: Log the received booking request
  console.log("Booking request received:", bookingRequest);

  // Validate request fields
  const requiredFields = [
    "movieId",
    "showId",
    "seats",
    "name",
    "email",
    "phoneNumber",
  ];
  
  const missingFields = requiredFields.filter(field => !bookingRequest[field]);

  if (missingFields.length > 0) {
    return res.status(401).json({ message: "Some fields are missing", missingFields });
  }

  // Validate movieId format
  if (!ObjectId.isValid(bookingRequest.movieId)) {
    return res.status(400).json({ message: "Invalid movie ID format" });
  }

  let requestedSeat = parseInt(bookingRequest.seats);
  if (isNaN(requestedSeat) || requestedSeat <= 0) {
    return res.status(401).json({ message: "Invalid seat count" });
  }

  try {
    const client = new MongoClient(URL, {});
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Use ObjectId in the query
    let movie = await collection.findOne({
      _id: new ObjectId(bookingRequest.movieId),
    });

    if (!movie) {
      console.log("Movie not found with ID:", bookingRequest.movieId);
      return res.status(404).json({ message: "Requested movie is not found" });
    }

    const show = Object.values(movie.shows)
      .flat()
      .find((s) => s.id === bookingRequest.showId);

    if (!show) {
      console.log("Show not found with ID:", bookingRequest.showId);
      return res.status(404).json({ message: "Show not Found" });
    }

    console.log("Available seats:", show.seats);
    if (parseInt(show.seats) < requestedSeat) {
      console.log("Not enough seats requested:", requestedSeat);
      return res.status(404).json({ message: "Not enough seats available" });
    }

    const updateSeats = parseInt(show.seats) - requestedSeat;

    const date = Object.keys(movie.shows).find((d) =>
      movie.shows[d].some((s) => s.id === bookingRequest.showId)
    );
    const showIndex = movie.shows[date].findIndex(
      (s) => s.id === bookingRequest.showId
    );

    const userBooking = {
      name: bookingRequest.name,
      email: bookingRequest.email,
      phoneNumber: bookingRequest.phoneNumber,
      seats: bookingRequest.seats,
    };

    const updatedResult = await collection.updateOne(
      { _id: new ObjectId(bookingRequest.movieId) },
      {
        $set: {
          [`shows.${date}.${showIndex}.seats`]: updateSeats,
        },
        $push: {
          [`shows.${date}.${showIndex}.bookings`]: userBooking,
        },
      }
    );

    console.log("Update result:", updatedResult);

    await client.close();

    if (updatedResult.modifiedCount === 0) {
      return res.status(500).json({ message: "Failed to update" });
    }

    return res.status(200).json({ message: "Booking created successfully" });
  } catch (error) {
    console.log("Error occurred:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});


app.listen(8000, () => {
  console.log("Server is running on port 8000");
});