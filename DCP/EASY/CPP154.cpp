class Stack{
    int cnt ;
    priority_queue<pair<int , int>> pq;
public:
    Stack(){
        cnt = 0;
    }
    void push(int n);
    void pop();
    bool isEmpty();
    int top();
};
void Stack::push(int n){
    cnt++;
    pq.push(make_pair(cnt , n));
}
void Stack::pop(){
    if( isEmpty() )
        cout << "Empty!!!! Can't reach" ;
    cnt--;
    pq.pop();
}
bool Stack::isEmpty(){
    return pq.empty();
}
int Stack::top(){
    pair<int , int> p = pq.top();
    return p.second;
}
int main(){
    Stack *s = new Stack();
    s->push( 1 );
    s->push( 2 );
    s->push( 3 );
    s->push( 4 );
    s->push( 5 );
    while( !s->isEmpty() ){
        cout << s->top() << endl;
        s->pop();
    }
    return 0;
}
