async function createDemoUser() {
  // Demo user credentials
  const demoUser = {
    email: 'demo@example.com',
    password: 'Demo123!',
    name: 'Demo User'
  };

  console.log('Demo User Credentials:');
  console.log('Email:', demoUser.email);
  console.log('Password:', demoUser.password);
  console.log('Name:', demoUser.name);
  console.log('\nTo login:');
  console.log('1. Open the application in your browser');
  console.log('2. Click on the "Login / Sign Up" button in the header');
  console.log('3. Select "Email" login method');
  console.log('4. Enter the email and password above');
  console.log('5. Click "Login"');
}

createDemoUser();
