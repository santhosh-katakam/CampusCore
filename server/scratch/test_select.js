const mongoose = require('mongoose');
const { Schema } = mongoose;

const TestSchema = new Schema({
    name: String,
    username: String,
    batch: String,
    department: String
});

const TestModel = mongoose.model('Test', TestSchema);

async function test() {
    await mongoose.connect('mongodb://localhost:27017/test_db');
    await TestModel.deleteMany({});
    const doc = await TestModel.create({ name: 'Test', username: 'test1', batch: '2021', department: 'CSE' });
    console.log('Created doc:', doc);
    
    const found = await TestModel.findOne({ username: 'test1' }).select('name username batch department');
    console.log('Found doc with select:', found);
    
    await mongoose.disconnect();
}

test();
