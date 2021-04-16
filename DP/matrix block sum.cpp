class Solution {
public:
    vector<vector<int>> matrixBlockSum(vector<vector<int>>& mat, int k) {
        int n = mat.size();
        int m = mat[0].size();
        
        vector< vector< int > > cum(n,vector<int> (m,0));
        vector< vector< int > > ans(n,vector<int> (m,0));
        cum[0][0] = mat[0][0];
        
        for (int i = 1 ; i < m ; i++)
            cum[0][i] = mat[0][i] + cum[0][i-1];
        
        for (int j = 1 ; j < n ; j++)
            cum[j][0] = mat[j][0] + cum[j-1][0];
            
        for (int i = 1 ; i < n ; i++){
            for (int j = 1 ; j < m ; j++){
                cum[i][j] = mat[i][j] + cum[i-1][j] + cum[i][j-1] - cum[i-1][j-1];
            }
        }
        
        for (int i = 0 ; i < n ; i++){
            for (int j = 0 ; j < m ; j++){
                int r_max = min(n-1,i+k);
                int c_max = min(m-1,j+k);
                int r_min = max(-1,i-k-1);
                int c_min = max(-1,j-k-1);

                if (r_min >= 0 && c_min >= 0)
                    ans[i][j] = cum[r_max][c_max] + cum[r_min][c_min] - cum[r_max][c_min] - cum[r_min][c_max];
                else if (r_min >= 0)
                    ans[i][j] = cum[r_max][c_max] - cum[r_min][c_max];
                else if (c_min >= 0)
                    ans[i][j] = cum[r_max][c_max] - cum[r_max][c_min];
                else
                    ans[i][j] = cum[r_max][c_max];
            }
        }
        return ans;
    }
};
