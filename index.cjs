require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const nodemailer = require("nodemailer");
const schedule = require('node-schedule');
const bcrypt = require('bcrypt');
const session = require('express-session');
const twilio = require('twilio');

const app = express();
const port = 3000;
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

const accountSid = process.env.TWILIO_ACCOUNT_SID; // Your Twilio account SID
const authToken = process.env.TWILIO_AUTH_TOKEN; // Your Twilio auth token
const client = new twilio(accountSid, authToken);

app.post("/submit", async(req, res) => {
    try {
        const { username, address, phone, email, donation_date, age, weight, blood_group, health, blood_volume } = req.body;

        const query = `
            INSERT INTO donor (username, address, phone, email, donation_date, age, weight, blood_group, health, blood_volume)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;
        await pool.query(query, [username, address, phone, email, donation_date, age, weight, blood_group, health, blood_volume]);

        const currentDate = new Date();

        try {
            const message = await client.messages.create({
                body: `Thank you, ${username}, for registering as a donor on ${currentDate.toDateString()}.`,
                from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio phone number
                to: phone
            });
            console.log(`SMS sent to ${username} at ${phone}`);
        } catch (error) {
            console.error(`Failed to send SMS: ${error}`);
        }

        res.redirect("/confirmation");
    } catch (error) {
        console.error(`Error in /submit: ${error}`);
        res.status(500).json({ error: "An error occurred while processing your request." });
    }
});

app.post("/feed", async(req, res) => {
    const name = req.body.name;
    const email = req.body.email;
    const message = req.body.message;

    try {
        const checkResult = await pool.query("SELECT * FROM contact WHERE email = $1", [email]);
        if (checkResult.rows.length > 0) {
            res.send("Email Already exist");
        } else {
            const result = await pool.query(
                "INSERT INTO contact (name, email, message) VALUES ($1, $2, $3)", [name, email, message]
            );

            console.log(result);
            res.render("thankyou"); // Render the thank you page
        }
    } catch (error) {
        console.error("Error inserting data:", error);
        res.status(500).send("An error occurred. Please try again later.");
    }
});

app.use(session({
    secret: '#123',
    resave: false,
    saveUninitialized: true,
}));
app.use(bodyParser.urlencoded({ extended: true }));


app.get('/', (req, res) => {
    const successMessage = req.session.successMessage;
    const successMessageExpiry = req.session.successMessageExpiry;

    // Check if the current date is before or on the donation date
    const showMessage = successMessage && new Date() <= new Date(successMessageExpiry);

    // Pass the message and conditionally render it
    res.render('Home/home.ejs', { successMessage, successMessageExpiry });
});

app.post('/create', (req, res) => {
    const donationDate = req.body.date;
    const location = req.body.location;
    const description = req.body.description;

    // Set the success message and its expiry date in the session
    req.session.successMessage = `The blood campaign is on ${donationDate} at ${location}. ${description}`;
    req.session.successMessageExpiry = donationDate;

    res.redirect('/');
});

app.get('/admin', async(req, res) => {
    try {
        pool.query('SELECT * FROM donor order by id desc', (err, result) => {
            if (err) {
                console.error(err);
                res.status(500).send('Server Error');
                return;
            }

            // Format each registration_date in the result set
            result.rows = result.rows.map(row => {
                const date = new Date(row.donation_date);

                // Extract the day, month, and year
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
                const year = date.getFullYear();

                // Format the date as dd-mm-yyyy
                row.donation_date = `${day}-${month}-${year}`;

                return row;
            });

            // Render the result with formatted dates
            res.render('Admin page/admin.ejs', {
                rows: result.rows
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }

});





const hardcodedUserId = 123;
const plainPassword = 'p123';
const saltRounds = 10;

// Hash the password synchronously
const hardcodedHashedPassword = bcrypt.hashSync(plainPassword, saltRounds);

app.post('/login', async(req, res) => {
    const { userid, password } = req.body;
    try {
        if (parseInt(userid) === hardcodedUserId) {
            const match = await bcrypt.compare(password, hardcodedHashedPassword);
            if (match) {
                res.redirect('/admin');
            } else {
                res.redirect('/login?error=invalid');
            }
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

app.get("/login", (req, res) => {
    res.render("auth/login.ejs");
});

app.get("/", (req, res) => {
    res.render("Home/home.ejs");
});

app.get("/services", (req, res) => {
    res.render("Home/services.ejs");
});

app.get("/privacy", (req, res) => {
    res.render("Home/privacy.ejs");
});

app.get("/contact", (req, res) => {
    res.render("Home/contact.ejs");
});

app.get("/register", (req, res) => {
    res.render("auth/register.ejs");
});

app.get("/confirmation", (req, res) => {
    res.render("confirmation.ejs");
});

app.get('/create-donation', (req, res) => {
    res.render('Admin page/create-donation.ejs');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});