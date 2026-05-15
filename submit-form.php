<?php
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$name    = trim(strip_tags($_POST['name']    ?? ''));
$email   = trim(strip_tags($_POST['email']   ?? ''));
$phone   = trim(strip_tags($_POST['phone']   ?? ''));
$message = trim(strip_tags($_POST['message'] ?? ''));

if (!$name || !$email || !$phone || !$message) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Todos los campos son requeridos']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email inválido']);
    exit;
}

$to      = 'matias.fontecilla@hotmail.com, rodriguez.u.carlos@gmail.com, fonte757@gmail.com';
$subject = 'Consulta de Inversión — Las Secoyas';

$body  = "Nombre:   $name\r\n";
$body .= "Email:    $email\r\n";
$body .= "Teléfono: $phone\r\n";
$body .= "Mensaje:\r\n$message";

$headers  = "From: info@inmejorableinversiongastronomica.com\r\n";
$headers .= "Reply-To: $email\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$sent = mail($to, $subject, $body, $headers);

if ($sent) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'No se pudo enviar el email']);
}
