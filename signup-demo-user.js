async function signupDemoUser() {
  // Demo user credentials
  const demoUser = {
    email: 'demo@example.com',
    password: 'Demo123!',
    name: 'Demo User'
  };

  try {
    console.log('Creating demo user...');
    
    // Since we're running this locally, we'll just show the curl command
    // that can be used to create the user
    console.log('To create the demo user, run this curl command:');
    console.log('curl -X POST http://localhost:5174/api/auth/signup \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d "{\"email\":\"demo@example.com\",\"password\":\"Demo123!\",\"name\":\"Demo User\"}"');
    
    console.log('Or you can sign up manually through the UI:');
    console.log('1. Open the application in your browser');
    console.log('2. Click on the "Login / Sign Up" button in the header');
    console.log('3. Toggle to "Sign Up" mode');
    console.log('4. Enter the following details:');
    console.log('   - Name: Demo User');
    console.log('   - Email: demo@example.com');
    console.log('   - Password: Demo123!');
    console.log('   - Confirm Password: Demo123!');
    console.log('5. Click "Sign Up"');
    
  } catch (error) {
    console.error('Error creating demo user:', error);
  }
}

signupDemoUser();
