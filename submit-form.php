<?php
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $name = $_POST['name'];
        $email = $_POST['email'];
        $phone = $_POST['phone'];
        $message = $_POST['message'];

        // validate the form data here (e.g. check for empty fields, validate email address format, etc.)

        // send an email to the site owner with the form data
        $to = 'matias.fontecilla@hotmail.com';
        $subject = 'New request';
        $body = "Name: $name\nEmail: $email\nPhone: $phone\nMessage: $message";
        $headers = "From: $email";
        mail($to, $subject, $body, $headers);

        // send a response back to the client indicating that the form was submitted successfully
        http_response_code(200);
    }
?>
