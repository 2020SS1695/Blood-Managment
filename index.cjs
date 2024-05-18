require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const nodemailer = require("nodemailer");
const schedule = require('node-schedule');
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

app.post("/submit", async(req, res) => {
    try {
        const { username, address, phone, email, registration_date, age, weight, blood_group, health, blood_volume } = req.body;
        if (!username) {
            return res.status(400).send("Username is required");
        }

        const query = `
            INSERT INTO donor (username, address, phone, email, registration_date, age, weight, blood_group, health, blood_volume)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;
        await pool.query(query, [username, address, phone, email, registration_date, age, weight, blood_group, health, blood_volume]);

        const registrationDate = new Date(registration_date);
        const scheduleDate = new Date(registrationDate.getFullYear(), registrationDate.getMonth(), registrationDate.getDate(), 16, 34, 0);

        console.log(`Scheduling email for ${username} at ${scheduleDate}`);

        const job = schedule.scheduleJob(scheduleDate, async function() {
            try {
                const transporter = nodemailer.createTransport({
                    host: "smtp.gmail.com",
                    port: 465,
                    secure: true,
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    },
                });

                const mailOptions = {
                    from: `"You" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: "Come and Donate the Blood",
                    html: `
                    <h1>Hello ${username}</h1>
                    <p>Thank you for registering as a blood donor. We encourage you to come and donate blood.</p>
                    <p>Below is the copy of your registered data:</p>
                    <ul>
                        <li>Username: ${username}</li>
                        <li>Address: ${address}</li>
                        <li>Phone: ${phone}</li>
                        <li>Email: ${email}</li>
                        <li>Registration Date: ${registration_date}</li>
                        <li>Age: ${age}</li>
                        <li>Weight: ${weight}</li>
                        <li>Blood Group: ${blood_group}</li>
                        <li>Health: ${health}</li>
                        <li>Blood Volume: ${blood_volume}</li>
                    </ul>
                    `,
                };

                console.log(`Sending email to ${email}`);
                const info = await transporter.sendMail(mailOptions);
                console.log('Email sent:', info.messageId);
            } catch (error) {
                console.error("Error sending email:", error);
            }
        });

        res.redirect("/confirmation");
    } catch (error) {
        console.error("Error inserting data into database:", error);
        res.status(500).send("An error occurred while processing your request.");
    }
});

const hardcodedUserId = 123;
const hardcodedPassword = 'p123';

app.post('/login', async(req, res) => {
    const { userid, password } = req.body;

    try {
        if (userid == hardcodedUserId) {
            const match = await bcrypt.compare(password, hardcodedPassword); // assuming hardcodedPassword is hashed
            if (match) {
                res.redirect('/admin');
            } else {
                res.redirect('/login?error=invalid');
            }
        } else {
            res.redirect('/login?error=invalid');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

app.get("/admin", async(req, res) => {
    try {
        const result = await pool.query('SELECT * FROM donor');
        const rows = result.rows.map(row => {
            const date = new Date(row.registration_date);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            row.registration_date = `${day}-${month}-${year}`;
            return row;
        });

        res.render('Admin page/admin.ejs', { rows });
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send('An error occurred while processing your request.');
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