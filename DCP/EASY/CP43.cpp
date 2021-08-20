class stack1{
    vector<int> v;
    int top;
    int max_ele;
public:
    stack1(){
        top = 0;
        max_ele = INT_MIN;
    } 
    void push( int n ){
        if( n > max_ele ){
            v.push_back(2*n - max_ele);
            max_ele = n;
        }
        else{
            v.push_back(n);
        }
    }
    int pop(){
        if( v.size() == 0 )
            return nullptr;
        else{
            int p = v.back();
            if( p > max_ele ){
                max_ele = 2 * max_ele - p;
            }
            v.erase(v.back());
            return p;
        }
    }
    int max_element_in_stack(){
        return max_ele;
    }
};
