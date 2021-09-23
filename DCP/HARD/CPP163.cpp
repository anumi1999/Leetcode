int to_num(string s){
    int y = 0 ;
    if( s[0] != '-')
        for( int i = 0 ; i < s.size() ; i++ ){
            y = y * 10 + (s[i] - '0');
        }
    else{
       for( int i = 1 ; i < s.size() ; i++ ){
            y = y * 10 + (s[i] - '0');
        }
        y = -1 * y;
    }
    return y;
}
class Solution {
public:
    int evalRPN(vector<string>& tokens) {
        stack<int> s;
        for( int i = 0 ; i < tokens.size() ; i++ ){
            if( tokens[i] != "+" && tokens[i] != "*" && tokens[i] != "-" && tokens[i] != "/" ){
                s.push(to_num(tokens[i]));
            }
            else{
                    int x = s.top();
                    s.pop();
                    int y = s.top();
                    s.pop();
                    cout << x << " " << y ;
                    if( tokens[i] == "+")
                        s.push(y + x);
                    else if( tokens[i] == "-")
                        s.push(y - x);
                    else if( tokens[i] == "*")
                        s.push(y * x);
                    else if( tokens[i] == "/")
                        s.push(y/x);
                
            }
        }
        return s.top();
    }
};
