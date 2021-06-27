class Solution {
public:
    bool isValid(string s) {
        stack<char> st;
        for( int i = 0 ; i < s.size() ; i++ ){
            if( st.empty()){
                st.push(s[i]);
                continue;
            }
            char t = st.top();
            if(t == '(' && s[i] == ')'){
                st.pop();
                continue;
            }if(t == '{' && s[i] == '}'){
                st.pop();
                continue;
            }if(t == '[' && s[i] == ']'){
                st.pop();
                continue;
            }if( t == ')' || t == '}' || t == ']' ){
                return false;
            }
            st.push(s[i]);
        }
        if( st.empty())
            return true;
        return false;
    }
};
