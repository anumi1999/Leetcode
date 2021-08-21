 void DFS( vector<vector<char>> &grid , int i , int j , int row , int col ){
        if( i < 0 || j < 0 ||  i > (row - 1) || j > (col - 1) || grid[i][j] != '1' )
            return;
        if( grid[i][j] == '1' ){
            grid[i][j] = '0';
            DFS( grid , i+1 , j , row , col);
            DFS( grid , i-1 , j , row , col);
            DFS( grid , i , j+1 , row , col);
            DFS( grid , i , j-1 , row , col);
        }
    }
    int numIslands(vector<vector<char>>& grid) {
        int row = grid.size();
        int col = grid[0].size();
        int cnt = 0;
        for( int i = 0 ; i < row ; i++ ){
            for( int j = 0 ; j < col ; j++ ){
                cout << grid[i][j];
                if( grid[i][j] == '1' ){
                    cout << "Hello";
                    grid[i][j] = '0';
                    cnt++;
                    DFS( grid , i+1 , j , row , col);
                    DFS( grid , i-1 , j , row , col);
                    DFS( grid , i , j+1 , row , col);
                    DFS( grid , i , j-1 , row , col);
                }
            }
        }
        return cnt;
    }
