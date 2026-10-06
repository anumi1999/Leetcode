#include<bits/stdc++.h>

using namespace std;

class MinStack {
    stack<int> mainStack;
    stack<int> minStack;
public:
    MinStack() {}

    void push(int val) {
        mainStack.push(val);
        if (minStack.empty()) {
            minStack.push(val);
        } else {
            minStack.push(min(val, minStack.top()));
        }
    }

    void pop() {
        mainStack.pop();
        minStack.pop();
    }

    int top() {
        return mainStack.top();
    }

    int getMin() {
        return minStack.top();
    }
};
