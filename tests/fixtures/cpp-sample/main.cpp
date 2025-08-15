#include <iostream>

class MyClass {
public:
    int myVar;
};

void myFunction(int a) {
    std::cout << "Hello from C++" << std::endl;
}

int main() {
    myFunction(5);
    return 0;
}
