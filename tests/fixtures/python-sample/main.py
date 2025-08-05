# tests/fixtures/python-sample/main.py
class Greeter:
    def __init__(self, name):
        self.name = name

def say_hello(person_name):
    greeter = Greeter(person_name)
    print(f"Hello, {greeter.name}!")