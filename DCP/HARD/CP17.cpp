class Solution {
public:
    int lengthLongestPath(string input) {
        stringstream ss(input);
        unordered_map<int , int> len;
        string data;
        int res = 0;
        while( getline(ss , data , '\n')){
            int num_tabs = 0;
            while( data[num_tabs] == '\t') num_tabs++;
            if( num_tabs == 0)
                len[num_tabs] = data.size();
            else{
                len[num_tabs] = len[num_tabs - 1] + 1 + data.substr(num_tabs).size();
            }
            if(data.find('.') != string :: npos)
                 res = max(res, len[num_tabs]);
        }
        return res;
    }
};
