from app import add, multiply, greet

def test_add():
    assert add(2, 3) == 5

def test_multiply():
    assert multiply(2, 3) == 6

def test_greet():
    assert greet("Jenkins") == "Hello, Jenkins!"
